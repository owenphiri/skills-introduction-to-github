"""
VoltexAI - Production hardening middleware
Cross-cutting concerns that make the API robust in production:

  * SecurityHeadersMiddleware — sensible security headers on every response.
  * RequestContextMiddleware  — per-request id + timing, structured access log,
    and a catch-all that converts unexpected exceptions into clean JSON 500s
    (never leaking a stack trace to the client) while logging the full trace.

Both are pure ASGI/Starlette middleware with no external dependencies.
"""
from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger("voltexai.request")

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-XSS-Protection": "0",  # modern browsers: rely on CSP, disable legacy auditor
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, hsts: bool = False):
        super().__init__(app)
        self.hsts = hsts

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        for k, v in _SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        # HSTS only in prod (HTTPS); never on plain-HTTP dev
        if self.hsts:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=63072000; includeSubDomains")
        return response


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        start = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception:
            # never leak internals; log the full trace with the request id
            elapsed = (time.perf_counter() - start) * 1000
            logger.exception("unhandled error rid=%s %s %s (%.1fms)",
                             rid, request.method, request.url.path, elapsed)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": rid},
                headers={"X-Request-ID": rid},
            )
        elapsed = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = rid
        response.headers["X-Response-Time-ms"] = f"{elapsed:.1f}"
        # skip noise from health probes
        if request.url.path not in ("/health", "/health/ready"):
            logger.info("rid=%s %s %s -> %s (%.1fms)",
                        rid, request.method, request.url.path,
                        response.status_code, elapsed)
        return response
