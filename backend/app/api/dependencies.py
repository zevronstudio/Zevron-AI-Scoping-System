import hashlib
import secrets
from datetime import timedelta
from typing import Annotated

from fastapi import Cookie, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import get_db
from app.models.entities import Guest, now

Db = Annotated[Session, Depends(get_db)]
COOKIE = "zevron_guest"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_guest(db: Db, zevron_guest: Annotated[str | None, Cookie()] = None) -> str:
    guest = db.get(Guest, token_hash(zevron_guest)) if zevron_guest else None
    if not guest or guest.expires_at < now():
        raise AppError(
            401, "session_expired", "Your guest session has expired. Reload to start a new session."
        )
    return guest.id


GuestId = Annotated[str, Depends(get_guest)]


def ensure_session(request: Request, response: Response, db: Session) -> None:
    token = request.cookies.get(COOKIE)
    guest = db.get(Guest, token_hash(token)) if token else None
    if guest and guest.expires_at > now():
        return
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    db.add(
        Guest(id=token_hash(token), expires_at=now() + timedelta(days=settings.guest_lifetime_days))
    )
    db.commit()
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="strict",
        max_age=settings.guest_lifetime_days * 86400,
        path="/",
    )
