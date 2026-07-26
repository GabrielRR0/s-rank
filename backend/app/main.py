from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.core.rate_limit import limiter
from app.routers.sharedContent.shared_content_router import router as shared_content_router

app = FastAPI(title="S-Rank API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# localhost:5173 siempre permitido (dev); FRONTEND_URL (produccion) se suma
# solo si esta configurada, sin duplicar si coinciden. Se calcula antes de
# los middlewares porque tanto CORS como verify_origin (mas abajo) la usan.
_dev_origin = "http://localhost:5173"
allowed_origins = {_dev_origin}
if settings.frontend_url:
    allowed_origins.add(settings.frontend_url)

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
async def verify_origin(request: Request, call_next):
    # Capa adicional a CORS, no un reemplazo: CORS solo le impide al
    # JavaScript de otro sitio LEER la respuesta, pero el request en si se
    # sigue procesando igual (un formulario oculto en una pagina maliciosa
    # podria disparar un POST "a ciegas" contra esta API usando el
    # navegador de una victima). Sin header Origin (curl, server-to-server,
    # /docs) no hay forma de distinguirlo de un cliente legitimo sin
    # navegador, asi que se deja pasar - esta capa apunta puntualmente a
    # bloquear paginas de OTROS sitios actuando desde un navegador. No es
    # (ni pretende ser) una forma de garantizar "solo mi frontend puede
    # llamar a esto": un atacante decidido con curl puede mandar cualquier
    # header Origin que quiera. Ver README para la explicacion completa.
    origin = request.headers.get("origin")
    if origin is not None and origin not in allowed_origins:
        return JSONResponse(status_code=403, content={"detail": "Origen no permitido."})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    # Efectivo una vez desplegado detras de HTTPS (Vercel lo da por
    # defecto); el navegador la ignora en dev sobre http simple.
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shared_content_router)
