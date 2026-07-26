from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile

from app.config import settings
from app.core.rate_limit import limiter
from app.schemas.sharedContent.shared_content_schemas import (
    CreateShareResponse,
    RevealedText,
    RevealRequest,
    ShareStatus,
)
from app.services.sharedContent import shared_content_service
from app.services.sharedContent.errors import ShareUnauthorizedError, ShareUnavailableError
from app.services.sharedContent.security.turnstile import verify_turnstile_token
from app.shared.storage.supabase_client import StorageClient, get_storage_client

router = APIRouter(prefix="/api/shared-content", tags=["shared-content"])


@router.post("", response_model=CreateShareResponse, status_code=201)
@limiter.limit(settings.rate_limit_create)
async def create_share(
    request: Request,
    response: Response,
    content_type: str = Form(...),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    password: str | None = Form(None),
    expires_in_minutes: int = Form(...),
    turnstile_token: str | None = Form(None),
    client: StorageClient = Depends(get_storage_client),
) -> CreateShareResponse:
    # multipart/form-data (no JSON): FastAPI no permite mezclar un body JSON
    # con UploadFile en el mismo endpoint, asi que el mismo formato de body
    # se usa para texto y archivo por igual (ver schemas/sharedContent/README.md).
    # No-op si TURNSTILE_ENABLED esta apagado (default) - ver security/turnstile.py.
    if not await verify_turnstile_token(turnstile_token):
        raise HTTPException(status_code=422, detail="Verificacion anti-bot fallida.")

    file_bytes = await file.read() if file is not None else None
    try:
        return shared_content_service.create_share(
            content_type=content_type,
            text=text,
            file_bytes=file_bytes,
            file_name=file.filename if file is not None else None,
            file_mime_type=file.content_type if file is not None else None,
            password=password or None,
            expires_in_minutes=expires_in_minutes,
            max_file_bytes=settings.max_file_bytes,
            client=client,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/{share_id}", response_model=ShareStatus)
@limiter.limit(settings.rate_limit_status)
def get_status(
    share_id: str,
    request: Request,
    response: Response,
    client: StorageClient = Depends(get_storage_client),
) -> ShareStatus:
    # Nunca lanza: un id inexistente/expirado es un resultado valido
    # (`exists: false`), no un error - lo pisan tanto el destinatario real
    # como cualquier bot de previsualizacion de enlaces.
    return shared_content_service.get_share_status(share_id, client)


@router.post("/{share_id}/reveal")
@limiter.limit(settings.rate_limit_reveal)
def reveal(
    share_id: str,
    request: Request,
    response: Response,
    body: RevealRequest,
    client: StorageClient = Depends(get_storage_client),
):
    try:
        result = shared_content_service.reveal_share(
            share_id, body.password, client, settings.share_password_max_attempts
        )
    except ShareUnavailableError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    except ShareUnauthorizedError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    if isinstance(result, RevealedText):
        return result

    # Archivo: se devuelve el binario directo (mismo patron que el PDF de
    # contract-generator), no JSON/base64, para que el navegador lo maneje
    # sin pasos intermedios en el frontend. "inline" para imagenes: el
    # frontend puede mostrarlas directo en un <img> en vez de forzar una
    # descarga; el resto de los tipos de archivo si fuerzan descarga.
    file_bytes, file_name, mime_type = result
    disposition = "inline" if mime_type.startswith("image/") else "attachment"
    return Response(
        content=file_bytes,
        media_type=mime_type,
        headers={"Content-Disposition": f'{disposition}; filename="{file_name}"'},
    )
