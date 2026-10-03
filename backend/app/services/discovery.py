import hashlib
import json
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.agent.runner import run_discovery
from app.core.config import get_settings
from app.core.errors import AppError
from app.models.entities import Guest, Message, Operation, Project, ProjectScope, Requirement, now
from app.repositories.projects import owned_project, project_detail
from app.schemas.domain import AgentResult, Scope, TurnRequest

STAGE_STATUS = {
    "initial_understanding": "Discovery",
    "clarification": "Clarification Needed",
    "requirement_confirmation": "Ready for Scope",
    "scope_generation": "Ready for Scope",
    "completed": "Scope Generated",
}


async def submit_turn(
    db: Session, project_id: str, guest_id: str, body: TurnRequest, mode: str
) -> dict:
    project = owned_project(db, project_id, guest_id)
    fingerprint = hashlib.sha256(
        json.dumps([mode, body.content, body.section], ensure_ascii=False).encode()
    ).hexdigest()
    previous = db.scalar(
        select(Operation).where(
            Operation.project_id == project_id, Operation.request_id == str(body.request_id)
        )
    )
    if previous:
        if previous.fingerprint != fingerprint:
            raise AppError(
                409,
                "request_reused",
                "This request identifier was already used. Reload and try again.",
            )
        return project_detail(db, project)

    stamp = now()
    settings = get_settings()
    request_id = str(body.request_id)
    token = str(uuid4())
    # A database lease serializes workers without holding a transaction over the LLM call.
    locked = db.execute(
        update(Project)
        .where(
            Project.id == project_id,
            or_(Project.busy_until.is_(None), Project.busy_until < stamp),
        )
        .values(
            busy_token=token,
            busy_until=stamp + timedelta(seconds=settings.agent_timeout_seconds + 30),
        )
    )
    if locked.rowcount != 1:
        db.rollback()
        raise AppError(
            409, "project_busy", "A request is already running for this project. Wait, then retry."
        )
    # Recheck after acquiring the lock: another worker may have completed the same request.
    previous = db.scalar(
        select(Operation).where(
            Operation.project_id == project_id, Operation.request_id == request_id
        )
    )
    if previous:
        db.rollback()
        if previous.fingerprint != fingerprint:
            raise AppError(409, "request_reused", "This request identifier was already used.")
        db.refresh(project)
        return project_detail(db, project)
    db.execute(
        update(Guest)
        .where(Guest.id == guest_id, Guest.rate_window < stamp - timedelta(hours=1))
        .values(rate_window=stamp, rate_count=0)
    )
    charged = db.execute(
        update(Guest)
        .where(Guest.id == guest_id, Guest.rate_count < settings.ai_requests_per_hour)
        .values(rate_count=Guest.rate_count + 1)
    )
    if charged.rowcount != 1:
        db.rollback()
        raise AppError(
            429,
            "rate_limited",
            "The discovery request limit has been reached. Try again in an hour.",
        )
    snapshot = project_detail(db, project)
    if body.section and not snapshot["scopes"]:
        db.rollback()
        raise AppError(409, "no_scope", "Prepare a brief before revising a section.")
    db.commit()
    try:
        result = AgentResult.model_validate(
            await run_discovery(snapshot, body.content, mode, body.section)
        )
        if body.section:
            if result.scope is None:
                raise AppError(
                    502,
                    "invalid_scope",
                    "The advisor did not return a revised section. Please retry.",
                )
            current = snapshot["scopes"][0]["data"].copy()
            current[body.section] = result.scope.model_dump()[body.section]
            result.scope = Scope.model_validate(current)
        db.expire_all()
        still_owned = db.execute(
            update(Project)
            .where(
                Project.id == project_id, Project.busy_token == token, Project.busy_until >= now()
            )
            .values(busy_token=None, busy_until=None)
        )
        if still_owned.rowcount != 1:
            raise AppError(
                409, "request_expired", "This request expired. Reload the project and retry."
            )
        project = owned_project(db, project_id, guest_id)
        persist_result(db, project, result, body.content, request_id, fingerprint)
        db.commit()
        return project_detail(db, project)
    finally:
        # Also releases on provider errors and cancellation. Failed turns never partially persist.
        db.rollback()
        db.execute(
            update(Project)
            .where(Project.id == project_id, Project.busy_token == token)
            .values(busy_token=None, busy_until=None)
        )
        db.commit()


def persist_result(
    db: Session,
    project: Project,
    result: AgentResult,
    content: str,
    request_id: str,
    fingerprint: str,
) -> None:
    if project.title == "Untitled project":
        project.title = result.title
    project.state = result.state.model_dump()
    project.stage = result.state.conversation_stage
    project.status = STAGE_STATUS[project.stage]
    project.business_type = result.state.business_type[:300]
    project.project_type = result.state.project_type[:300]
    project.revision += 1
    project.updated_at = now()
    db.add(Message(project_id=project.id, role="user", content=content))
    db.flush()
    db.add(
        Message(
            project_id=project.id,
            role="assistant",
            content=result.reply,
            questions=result.questions,
        )
    )
    db.execute(delete(Requirement).where(Requirement.project_id == project.id))
    for requirement in result.requirements:
        db.add(Requirement(project_id=project.id, **requirement.model_dump()))
    if result.scope:
        version = (
            db.scalar(
                select(func.max(ProjectScope.version)).where(ProjectScope.project_id == project.id)
            )
            or 0
        )
        db.add(
            ProjectScope(
                project_id=project.id,
                summary=result.scope.executive_summary,
                structured_scope=result.scope.model_dump(),
                version=version + 1,
            )
        )
    db.add(Operation(project_id=project.id, request_id=request_id, fingerprint=fingerprint))
