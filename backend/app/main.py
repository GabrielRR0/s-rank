from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.core.rate_limit import limiter
from app.routers.sharedContent.shared_content_router import router as shared_content_router

app = FastAPI(title="File Sharer API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Mismo orden de middlewares que contract-generator (ver ese proyecto para
# el detalle completo): Starlette envuelve en orden inverso al que se
# agregan, y CORS tiene que quedar afuera de todo -> se agrega al final,
# para que sus headers lleguen incluso a respuestas cortadas antes de
# tiempo por los middlewares de abajo (ej. el 413 de body gigante), y el
# navegador no las trate como error de CORS en vez del error real.
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def reject_oversized_body(request: Request, call_next):
    # Corta requests con body gigante antes de que lleguen a Pydantic o a
    # Supabase Storage. Se basa en el header Content-Length: no protege
    # contra un atacante que mande el body chunked sin declararlo, pero
    # cubre el caso normal (fetch/multipart siempre lo declara).
    content_length = request.headers.get("content-length")
    if content_length is not None and int(content_length) > settings.max_body_bytes:
        return JSONResponse(status_code=413, content={"detail": "Request body demasiado grande."})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


# localhost:5173 siempre permitido (dev); FRONTEND_URL (produccion) se suma
# solo si esta configurada, sin duplicar si coinciden.
_dev_origin = "http://localhost:5173"
allowed_origins = {_dev_origin}
if settings.frontend_url:
    allowed_origins.add(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shared_content_router)
