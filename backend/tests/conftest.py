import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.db.session import Base, get_db, make_engine
from app.main import app, session_requests


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Tests must not depend on developer credentials or local provider configuration.
    monkeypatch.setattr(get_settings(), "llm_provider", "openai")
    monkeypatch.setattr(get_settings(), "llm_model", "test-model")
    monkeypatch.setattr(get_settings(), "openai_api_key", "")
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def override_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    session_requests.clear()
    with TestClient(app) as client:
        client.post("/api/v1/session")
        yield client
    app.dependency_overrides.clear()
    engine.dispose()
