"""Test-only HTTP harness: real API/database, deterministic provider boundary.

Never imported by the production entrypoint. Used only by Playwright's webServer.
"""

import os

os.environ["DATABASE_URL"] = "sqlite:///./e2e.db"
os.environ["FRONTEND_URL"] = "http://localhost:3100"

from app import main  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db.session import Base, engine  # noqa: E402
from app.services import discovery  # noqa: E402
from tests.test_flow import answer  # noqa: E402

Base.metadata.create_all(engine)
get_settings().openai_api_key = "test-only-not-a-provider-key"
get_settings().llm_provider = "openai"
get_settings().llm_model = "test-model"


async def deterministic_provider(snapshot, content, mode, section):
    result = answer(scope=mode == "scope")
    if section and result.scope:
        result.scope.executive_summary = "A clear booking website for patients and clinic staff."
    return result


discovery.run_discovery = deterministic_provider
app = main.app
