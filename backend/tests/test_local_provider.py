import asyncio
import json

import httpx
import pytest
from openai import AsyncOpenAI
from pydantic import ValidationError

from app.agent.output import DiscoverySubmission, decode_container_fields
from app.agent.runner import run_discovery
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from tests.test_flow import answer, create, send


@pytest.mark.parametrize("provider", ["local", "minimax"])
@pytest.mark.parametrize("encoded_containers", [False, True])
def test_local_request_uses_configured_endpoint_key_and_structured_output(
    monkeypatch, provider, encoded_containers
):
    settings = get_settings()
    monkeypatch.setattr(settings, "llm_provider", provider)
    monkeypatch.setattr(settings, "llm_base_url", "http://localhost:1234/v1")
    monkeypatch.setattr(settings, "llm_api_key", "local-test-key")
    monkeypatch.setattr(settings, "llm_model", "local-test-model")
    captured = []

    def respond(request):
        captured.append(request)
        payload = answer().model_dump()
        if encoded_containers and provider == "minimax":
            payload["questions"] = json.dumps(payload["questions"])
            payload["requirements"] = json.dumps(payload["requirements"])
            payload["scope"] = "null"
            for field, value in payload["state"].items():
                if isinstance(value, list):
                    payload["state"][field] = json.dumps(value)
        message = {"role": "assistant", "content": json.dumps(payload)}
        if provider == "minimax":
            message = {
                "role": "assistant",
                "content": None,
                "reasoning_content": "Private reasoning must not be exposed",
                "tool_calls": [
                    {
                        "id": "call_1",
                        "type": "function",
                        "function": {
                            "name": "submit_discovery",
                            "arguments": json.dumps({"result": payload}),
                        },
                    }
                ],
            }
        return httpx.Response(
            200,
            json={
                "id": "test",
                "object": "chat.completion",
                "created": 1,
                "model": "local-test-model",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "tool_calls" if provider == "minimax" else "stop",
                        "message": message,
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            },
        )

    def client(**kwargs):
        return AsyncOpenAI(
            **kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond))
        )

    monkeypatch.setattr("app.agent.runner.AsyncOpenAI", client)
    result = asyncio.run(
        run_discovery(
            {"state": {}, "requirements": [], "scopes": [], "messages": []},
            "Clinic idea",
            "message",
            None,
        )
    )
    assert result.state.business_type == "Dental clinic"
    assert len(captured) == 1
    request = captured[0]
    assert str(request.url) == "http://localhost:1234/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer local-test-key"
    body = json.loads(request.content)
    assert body["model"] == "local-test-model"
    if provider == "minimax":
        assert "response_format" not in body
        assert body["tool_choice"]["function"]["name"] == "submit_discovery"
        assert body["reasoning_split"] is True
        assert "Private reasoning" not in result.model_dump_json()
    else:
        assert body["response_format"]["type"] == "json_schema"


def test_local_mode_never_falls_back_to_openai(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "llm_provider", "local")
    monkeypatch.setattr(settings, "llm_base_url", "")
    monkeypatch.setattr(settings, "llm_api_key", "local-key")
    monkeypatch.setattr(settings, "openai_api_key", "cloud-key")
    assert not settings.discovery_available
    with pytest.raises(AppError) as error:
        asyncio.run(run_discovery({}, "Idea", "message", None))
    assert error.value.code == "agent_unconfigured"


@pytest.mark.parametrize(
    "url", ["file:///secret", "http://user:pass@localhost/v1", "https://host/v1?key=secret"]
)
def test_invalid_provider_url_is_rejected(url):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, llm_base_url=url)


@pytest.mark.parametrize("empty", [None, "", "None", "null", {}])
def test_optional_empty_containers_are_safe_but_incomplete_briefs_are_rejected(empty):
    payload = answer().model_dump()
    payload["state"]["constraints"] = empty
    payload["scope"] = empty
    decoded = decode_container_fields({"result": payload}, DiscoverySubmission)
    result = DiscoverySubmission.model_validate(decoded).result
    assert result.state.constraints == []
    assert result.scope is None
    decoded["result"]["state"]["conversation_stage"] = "completed"
    with pytest.raises(ValidationError):
        DiscoverySubmission.model_validate(decoded)


@pytest.mark.parametrize("recover", [True, False])
def test_minimax_repairs_invalid_results_before_persisting(client, monkeypatch, recover):
    settings = get_settings()
    monkeypatch.setattr(settings, "llm_provider", "minimax")
    monkeypatch.setattr(settings, "llm_base_url", "http://local-test/v1")
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    requests = []

    def respond(request):
        body = json.loads(request.content)
        requests.append(body)
        payload = answer().model_dump()
        if not recover or len(requests) == 1:
            payload["questions"] = ["Question"] * 5
        return httpx.Response(
            200,
            json={
                "id": f"test-{len(requests)}",
                "object": "chat.completion",
                "created": 1,
                "model": "test-model",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "tool_calls",
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": f"call-{len(requests)}",
                                    "type": "function",
                                    "function": {
                                        "name": "submit_discovery",
                                        "arguments": json.dumps({"result": payload}),
                                    },
                                }
                            ],
                        },
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            },
        )

    def fake_client(**kwargs):
        return AsyncOpenAI(
            **kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond))
        )

    monkeypatch.setattr("app.agent.runner.AsyncOpenAI", fake_client)
    project_id = create(client)
    response = send(client, project_id)
    assert response.status_code == (200 if recover else 502)
    assert len(requests) == (2 if recover else 3)
    assert requests[1]["tool_choice"]["function"]["name"] == "submit_discovery"
    feedback = [m for m in requests[1]["messages"] if m["role"] == "tool"]
    assert "failed schema validation" in feedback[-1]["content"]
    saved = client.get(f"/api/v1/projects/{project_id}").json()
    assert len(saved["messages"]) == (2 if recover else 0)
    assert saved["revision"] == (1 if recover else 0)
    if not recover:
        assert response.json()["error"]["code"] == "invalid_agent_response"


def test_normalizes_loose_model_output_payloads():
    from app.agent.output import DiscoverySubmission, decode_container_fields, normalize_submission_dict

    p1 = {
        "result": {
            "title": "Medical Clinic",
            "reply": "Thank you for the information.",
            "questions": None,
            "state": {
                "target_users": "",
                "requested_features": None,
                "confirmed_requirements": {},
                "missing_requirements": "none",
                "constraints": "[]",
                "integrations": "null",
            },
            "technical_preferences": ["FastAPI", "Next.js"],
            "assumptions": ["English speaking"],
            "conversation_stage": "clarification",
            "requirements": None,
        }
    }
    norm1 = normalize_submission_dict(p1)
    decoded1 = decode_container_fields(norm1, DiscoverySubmission)
    res1 = DiscoverySubmission.model_validate(decoded1).result
    assert res1.title == "Medical Clinic"
    assert res1.state.technical_preferences == ["FastAPI", "Next.js"]
    assert res1.state.target_users == []

    p2 = {
        "category": "core",
        "key": "platform",
        "value": "Mobile App",
        "status": "confirmed",
        "source": "user",
        "scope": None,
        "result": {
            "title": "App Project",
            "reply": "Great choice.",
            "requirements": None,
        },
    }
    norm2 = normalize_submission_dict(p2)
    decoded2 = decode_container_fields(norm2, DiscoverySubmission)
    res2 = DiscoverySubmission.model_validate(decoded2).result
    assert res2.title == "App Project"
    assert len(res2.requirements) == 1
    assert res2.requirements[0].key == "platform"

    p3 = {
        "result": {
            "title": "Clinic App",
            "reply": "Noted.",
            "category": "core",
            "key": "booking",
            "value": "Online calendar",
            "status": "confirmed",
            "source": "client",
            "unknown_field": "some data",
            "thinking": "I am thinking",
        }
    }
    norm3 = normalize_submission_dict(p3)
    decoded3 = decode_container_fields(norm3, DiscoverySubmission)
    res3 = DiscoverySubmission.model_validate(decoded3).result
    assert res3.title == "Clinic App"
    assert len(res3.requirements) == 1
    assert res3.requirements[0].key == "booking"

    p4 = {
        "result": {
            "title": "Clinic App",
            "reply": "Noted.",
            "requirements": ["Online appointment booking", "Stripe payment integration"],
        }
    }
    norm4 = normalize_submission_dict(p4)
    decoded4 = decode_container_fields(norm4, DiscoverySubmission)
    res4 = DiscoverySubmission.model_validate(decoded4).result
    assert len(res4.requirements) == 2
    assert res4.requirements[0].value == "Online appointment booking"


