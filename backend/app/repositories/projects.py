from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.entities import Message, Project, ProjectScope, Requirement
from app.schemas.domain import AgentState


def owned_project(db: Session, project_id: str, guest_id: str) -> Project:
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.guest_id == guest_id)
    )
    if not project:
        raise AppError(404, "not_found", "This project is unavailable in this browser session.")
    return project


def project_summary(project: Project) -> dict:
    return {
        key: getattr(project, key)
        for key in ("id", "title", "status", "stage", "created_at", "updated_at", "revision")
    }


def project_detail(db: Session, project: Project) -> dict:
    messages = db.scalars(
        select(Message)
        .where(Message.project_id == project.id)
        .order_by(Message.created_at, Message.id)
    ).all()
    scopes = db.scalars(
        select(ProjectScope)
        .where(ProjectScope.project_id == project.id)
        .order_by(ProjectScope.version.desc())
        .limit(20)
    ).all()
    requirements = db.scalars(select(Requirement).where(Requirement.project_id == project.id)).all()
    return {
        **project_summary(project),
        "state": AgentState.model_validate(project.state).model_dump(),
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "questions": m.questions,
                "created_at": m.created_at,
            }
            for m in messages
        ],
        "scopes": [
            {
                "id": s.id,
                "version": s.version,
                "created_at": s.created_at,
                "data": s.structured_scope,
            }
            for s in scopes
        ],
        "requirements": [
            {
                "category": r.category,
                "key": r.key,
                "value": r.value,
                "status": r.status,
                "source": r.source,
            }
            for r in requirements
        ],
    }
