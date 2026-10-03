from uuid import uuid4

import pytest
from agents import AgentOutputSchema
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.errors import AppError
from app.schemas.domain import AgentResult, AgentState, Scope


def brief():
    return Scope(
        executive_summary="Clinic appointment booking",
        business_problem="Phone booking takes time",
        proposed_solution="A simple booking website",
        target_users=["Patients"],
        features=[{"name": "Booking", "items": ["Request an appointment"]}],
        user_roles=["Patient", "Clinic administrator"],
        user_flows=["Select service → Request time → Receive confirmation"],
        functional_requirements=["Staff approve appointment requests"],
        non_functional_requirements=["Keyboard accessible", "Mobile responsive"],
        technical_architecture="Public site and protected staff area",
        suggested_stack=[{"name": "PostgreSQL", "purpose": "Store bookings"}],
        integrations=["Email"],
        modules=["Booking", "Staff area"],
        complexity={"level": "medium", "reason": "Scheduling and staff permissions"},
        assumptions=["One location"],
        open_questions=["Email provider"],
        future_enhancements=[],
    )


def answer(scope=False):
    return AgentResult(
        title="Clinic booking",
        reply="Here is the direction for your clinic." if scope else "Let’s clarify booking.",
        questions=[]
        if scope
        else ["Who approves appointments?", "Should patients receive email confirmations?"],
        state=AgentState(
            business_type="Dental clinic",
            business_goal="Reduce phone bookings",
            target_users=["Patients"],
            confirmed_requirements=["Appointment requests"],
            conversation_stage="completed" if scope else "clarification",
        ),
        requirements=[
            {
                "category": "booking",
                "key": "appointments",
                "value": "Appointment requests",
                "status": "confirmed",
                "source": "Client requested booking",
            }
        ],
        scope=brief() if scope else None,
    )


def create(client):
    response = client.post("/api/v1/projects", json={"id": str(uuid4())})
    assert response.status_code == 201
    return response.json()["id"]


def send(
    client,
    project_id,
    content="A website for my dental clinic",
    request_id=None,
    endpoint="messages",
    **extra,
):
    return client.post(
        f"/api/v1/projects/{project_id}/{endpoint}",
        json={
            "request_id": request_id or str(uuid4()),
            "content": content,
            **extra,
        },
    )


def test_project_crud_and_guest_isolation(client):
    project_id = create(client)
    assert client.post("/api/v1/projects", json={"id": project_id}).status_code == 200
    assert len(client.get("/api/v1/projects").json()) == 1
    assert (
        client.patch(f"/api/v1/projects/{project_id}", json={"title": "Clinic"}).json()["title"]
        == "Clinic"
    )
    cookies = dict(client.cookies)
    client.cookies.clear()
    assert client.get(f"/api/v1/projects/{project_id}").status_code == 401
    client.post("/api/v1/session")
    assert client.get(f"/api/v1/projects/{project_id}").status_code == 404
    assert client.delete(f"/api/v1/projects/{project_id}").status_code == 404
    client.cookies.update(cookies)
    assert client.delete(f"/api/v1/projects/{project_id}").status_code == 204
    assert client.get("/api/v1/projects").json() == []


def test_discovery_scope_restore_and_idempotency(client, monkeypatch):
    calls = []

    async def fake(snapshot, content, mode, section):
        calls.append((snapshot, content))
        return answer(scope=mode == "scope")

    monkeypatch.setattr("app.services.discovery.run_discovery", fake)
    project_id = create(client)
    key = str(uuid4())
    first = send(client, project_id, request_id=key)
    assert first.status_code == 200
    assert first.json()["state"]["business_type"] == "Dental clinic"
    assert len(first.json()["messages"]) == 2
    assert first.json()["requirements"][0]["status"] == "confirmed"
    assert send(client, project_id, request_id=key).status_code == 200
    assert len(calls) == 1
    assert send(client, project_id, content="Different", request_id=key).status_code == 409
    generated = send(
        client,
        project_id,
        content="Staff approves. Please prepare the brief.",
        endpoint="generate-scope",
    )
    assert generated.status_code == 200
    assert generated.json()["scopes"][0]["version"] == 1
    assert len(calls[1][0]["messages"]) == 2
    restored = client.get(f"/api/v1/projects/{project_id}").json()
    assert restored["status"] == "Scope Generated"
    assert len(restored["messages"]) == 4
    assert len(client.get(f"/api/v1/projects/{project_id}/messages").json()) == 4


def test_section_regeneration_preserves_other_sections(client, monkeypatch):
    async def fake(snapshot, content, mode, section):
        result = answer(scope=True)
        if section:
            result.scope.executive_summary = "Revised summary"
            result.scope.business_problem = "Unrequested change"
        return result

    monkeypatch.setattr("app.services.discovery.run_discovery", fake)
    project_id = create(client)
    send(client, project_id, endpoint="generate-scope")
    result = send(
        client,
        project_id,
        content="Make it clearer",
        endpoint="generate-scope",
        section="executive_summary",
    ).json()
    assert result["scopes"][0]["version"] == 2
    assert result["scopes"][0]["data"]["executive_summary"] == "Revised summary"
    assert result["scopes"][0]["data"]["business_problem"] == "Phone booking takes time"


@pytest.mark.parametrize("content", ["", "   ", "x" * 6001])
def test_input_validation(client, content):
    assert send(client, create(client), content=content).status_code == 422


def test_errors_do_not_persist_partial_turn_and_allow_retry(client, monkeypatch):
    async def fail(*args):
        raise AppError(504, "agent_timeout", "Please retry.")

    monkeypatch.setattr("app.services.discovery.run_discovery", fail)
    project_id = create(client)
    key = str(uuid4())
    assert send(client, project_id, request_id=key).status_code == 504
    assert client.get(f"/api/v1/projects/{project_id}").json()["messages"] == []

    async def success(*args):
        return answer()

    monkeypatch.setattr("app.services.discovery.run_discovery", success)
    assert send(client, project_id, request_id=key).status_code == 200


def test_unconfigured_provider(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "openai_api_key", "")
    result = send(client, create(client))
    assert result.status_code == 503
    assert "agent_unconfigured" in result.text


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_requests_per_hour", 0)
    assert send(client, create(client)).status_code == 429


def test_invalid_id_origin_and_body(client):
    assert client.get("/api/v1/projects/not-an-id").status_code == 422
    assert (
        client.post(
            "/api/v1/projects",
            json={"id": str(uuid4())},
            headers={"Origin": "https://untrusted.example"},
        ).status_code
        == 403
    )
    assert client.post("/api/v1/projects", content="x" * 40000).status_code == 413


def test_schema_rejects_malformed_and_sdk_accepts_contract():
    AgentOutputSchema(AgentResult)
    with pytest.raises(ValidationError):
        Scope.model_validate({"executive_summary": "Missing fields"})
    with pytest.raises(ValidationError):
        answer().model_copy(update={"questions": ["?"] * 5}).model_dump()
        AgentResult.model_validate({**answer().model_dump(), "questions": ["?"] * 5})
    with pytest.raises(ValidationError):
        AgentResult.model_validate(
            {**answer().model_dump(), "state": {"conversation_stage": "completed"}}
        )
