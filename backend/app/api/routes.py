from uuid import UUID

from fastapi import APIRouter, Request, Response
from sqlalchemy import delete, or_, select, update
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import Db, GuestId, ensure_session
from app.core.config import get_settings
from app.core.errors import AppError
from app.models.entities import Project, now
from app.repositories.projects import owned_project, project_detail, project_summary
from app.schemas.domain import CreateProject, ProjectPatch, TurnRequest
from app.services.discovery import submit_turn

router = APIRouter(prefix="/api/v1")


@router.get("/health")
def health(db: Db):
    db.execute(select(1))
    return {"status": "ok", "discovery_available": get_settings().discovery_available}


@router.post("/session", status_code=204)
def session(request: Request, response: Response, db: Db):
    ensure_session(request, response, db)


@router.get("/projects")
def list_projects(db: Db, guest: GuestId):
    projects = db.scalars(
        select(Project).where(Project.guest_id == guest).order_by(Project.updated_at.desc())
    )
    return [project_summary(p) for p in projects]


@router.post("/projects", status_code=201)
def create_project(body: CreateProject, db: Db, guest: GuestId, response: Response):
    existing = db.get(Project, str(body.id))
    if existing:
        existing = owned_project(db, str(body.id), guest)
        response.status_code = 200
        return project_detail(db, existing)
    project = Project(
        id=str(body.id), title=body.title.strip() or "Untitled project", guest_id=guest
    )
    db.add(project)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        project = owned_project(db, str(body.id), guest)
        response.status_code = 200
    return project_detail(db, project)


@router.get("/projects/{project_id}")
def get_project(project_id: UUID, db: Db, guest: GuestId):
    return project_detail(db, owned_project(db, str(project_id), guest))


@router.get("/projects/{project_id}/messages")
def get_messages(project_id: UUID, db: Db, guest: GuestId):
    return project_detail(db, owned_project(db, str(project_id), guest))["messages"]


def require_mutation(changed: int):
    if changed != 1:
        raise AppError(
            409,
            "project_busy",
            "Wait for the current request to finish before changing this project.",
        )


@router.patch("/projects/{project_id}")
def rename_project(project_id: UUID, body: ProjectPatch, db: Db, guest: GuestId):
    project = owned_project(db, str(project_id), guest)
    changed = db.execute(
        update(Project)
        .where(
            Project.id == str(project_id),
            or_(Project.busy_until.is_(None), Project.busy_until < now()),
        )
        .values(title=body.title, updated_at=now())
    )
    require_mutation(changed.rowcount)
    db.commit()
    return project_detail(db, project)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: UUID, db: Db, guest: GuestId):
    project = owned_project(db, str(project_id), guest)
    changed = db.execute(
        delete(Project).where(
            Project.id == project.id, or_(Project.busy_until.is_(None), Project.busy_until < now())
        )
    )
    require_mutation(changed.rowcount)
    db.commit()


@router.post("/projects/{project_id}/messages")
async def send_message(project_id: UUID, body: TurnRequest, db: Db, guest: GuestId):
    return await submit_turn(db, str(project_id), guest, body, "message")


@router.post("/projects/{project_id}/generate-scope")
async def generate_scope(project_id: UUID, body: TurnRequest, db: Db, guest: GuestId):
    return await submit_turn(db, str(project_id), guest, body, "scope")
