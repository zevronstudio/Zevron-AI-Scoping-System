import logging
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from app.api.routes import router
from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)
app = FastAPI(title="Zevron Scope API", docs_url=None, redoc_url=None)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
app.include_router(router)
session_requests: dict[str, deque] = defaultdict(deque)


def error(status: int, code: str, message: str):
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.middleware("http")
async def protect_requests(request: Request, call_next):
    if request.method in {"POST", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") != settings.frontend_url.rstrip("/"):
            return error(403, "invalid_origin", "This request origin is not allowed.")
        length = request.headers.get("content-length", "0")
        if not length.isdigit() or int(length) > 32768:
            return error(413, "too_large", "The request is too large. Please shorten your message.")
        payload = await request.body()
        if len(payload) > 32768:
            return error(413, "too_large", "The request is too large. Please shorten your message.")
    if request.url.path == "/api/v1/session" and request.method == "POST":
        stamp = time.monotonic()
        key = request.client.host if request.client else "unknown"
        for old_key in list(session_requests):
            if not session_requests[old_key] or session_requests[old_key][-1] < stamp - 3600:
                del session_requests[old_key]
        bucket = session_requests[key]
        while bucket and bucket[0] < stamp - 3600:
            bucket.popleft()
        if len(bucket) >= 120:
            return error(429, "rate_limited", "Too many session requests. Please try later.")
        bucket.append(stamp)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(AppError)
async def app_error(_request: Request, exc: AppError):
    return error(exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, _exc: RequestValidationError):
    return error(
        422, "invalid_input", "Please check your input. Messages must contain 1–6,000 characters."
    )


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException):
    return error(exc.status_code, "http_error", "The requested action is unavailable.")


@app.exception_handler(SQLAlchemyError)
async def database_error(_request: Request, exc: SQLAlchemyError):
    logger.error("Database operation failed (%s)", type(exc).__name__)
    return error(503, "database_error", "Your project could not be accessed. Please retry shortly.")


@app.exception_handler(Exception)
async def unexpected_error(_request: Request, exc: Exception):
    logger.error("Request failed (%s)", type(exc).__name__)
    return error(500, "internal_error", "Something went wrong. Please retry shortly.")
