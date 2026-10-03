import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from types import SimpleNamespace

import pytest

from app.agent.context import build_context
from app.core.config import get_settings
from tests.test_flow import answer, create, send


def test_project_lease_blocks_concurrent_turns_and_edits(client, monkeypatch):
    entered, release = Event(), Event()

    async def slow_provider(*args):
        entered.set()
        await asyncio.to_thread(release.wait, 10)
        return answer()

    monkeypatch.setattr("app.services.discovery.run_discovery", slow_provider)
    project_id = create(client)
    with ThreadPoolExecutor() as pool:
        first = pool.submit(send, client, project_id)
        try:
            assert entered.wait(5)
            assert send(client, project_id).status_code == 409
            assert (
                client.patch(f"/api/v1/projects/{project_id}", json={"title": "Racing"}).status_code
                == 409
            )
            assert client.delete(f"/api/v1/projects/{project_id}").status_code == 409
        finally:
            release.set()
        assert first.result(timeout=10).status_code == 200
    assert len(client.get(f"/api/v1/projects/{project_id}").json()["messages"]) == 2


@pytest.mark.parametrize("failure", ["malformed", "timeout"])
def test_provider_errors_are_safe_and_atomic(client, monkeypatch, failure):
    monkeypatch.setattr(get_settings(), "openai_api_key", "test-placeholder")

    async def broken_runner(*args, **kwargs):
        if failure == "timeout":
            raise TimeoutError("private provider detail")
        return SimpleNamespace(final_output={"reply": "invalid output"})

    monkeypatch.setattr("app.agent.runner.Runner.run", broken_runner)
    project_id = create(client)
    response = send(client, project_id)
    assert response.status_code == (504 if failure == "timeout" else 502)
    assert "private provider detail" not in response.text
    assert client.get(f"/api/v1/projects/{project_id}").json()["messages"] == []


def test_context_is_bounded_and_preserves_structured_memory():
    project = {
        "state": answer().state.model_dump(),
        "requirements": [],
        "scopes": [],
        "messages": [{"role": "user", "content": "x" * 6000, "questions": []}] * 1000,
    }
    context = json.loads(build_context(project, "Latest correction", "message", None))
    assert len(context["recent_messages"]) == 12
    assert len(context["recent_messages"][0]["content"]) == 2000
    assert context["structured_memory"]["business_type"] == "Dental clinic"
    assert context["client_message"] == "Latest correction"
