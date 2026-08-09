from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile

from app.config import settings
from app.core.rate_limit import limiter
from app.schemas.secretVault.secret_vault_schemas import (
    CreateVaultItemRequest,
    CreateVaultItemResponse,
    VaultItemResponse,
)
from app.services.secretVault import secret_vault_service
from app.services.secretVault.errors import VaultUnavailableError
from app.shared.storage.supabase_vault_client import VaultStorageClient, get_vault_storage_client

router = APIRouter(prefix="/api/secret-vault", tags=["secret-vault"])


@router.post("", response_model=CreateVaultItemResponse, status_code=201)
@limiter.limit(settings.rate_limit_vault_create)
def create_vault_item(
    request: Request,
    response: Response,
    body: CreateVaultItemRequest,
    client: VaultStorageClient = Depends(get_vault_storage_client),
) -> CreateVaultItemResponse:
    if len(body.ciphertext.encode("utf-8")) > settings.vault_max_ciphertext_bytes:
        raise HTTPException(status_code=422, detail="El contenido del cofre es demasiado grande.")
    try:
        return secret_vault_service.create_vault_item(
            ciphertext=body.ciphertext,
            nonce=body.nonce,
            max_copies=body.max_copies,
            ttl_seconds=body.ttl_seconds,
            room_id=body.room_id,
            client=client,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/media", response_model=CreateVaultItemResponse, status_code=201)
@limiter.limit(settings.rate_limit_vault_create)
async def create_vault_media_item(
    request: Request,
    response: Response,
    content_type: str = Form(...),
    mime_type: str = Form(...),
    max_copies: int = Form(...),
    ttl_seconds: int = Form(...),
    nonce: str = Form(...),
    room_id: str | None = Form(None),
    ciphertext_file: UploadFile = File(...),
    client: VaultStorageClient = Depends(get_vault_storage_client),
) -> CreateVaultItemResponse:
    # multipart/form-data, ruta separada de POST "" (texto): mismo motivo
    # que shared_content_router - FastAPI no permite mezclar un body JSON
    # con UploadFile en el mismo endpoint.
    ciphertext_bytes = await ciphertext_file.read()
    try:
        return secret_vault_service.create_vault_media_item(
            content_type=content_type,
            mime_type=mime_type,
            max_copies=max_copies,
            ttl_seconds=ttl_seconds,
            nonce=nonce,
            ciphertext_bytes=ciphertext_bytes,
            max_bytes=settings.vault_media_max_bytes,
            room_id=room_id,
            client=client,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/{item_id}", response_model=VaultItemResponse)
@limiter.limit(settings.rate_limit_vault_status)
def get_vault_item(
    item_id: str,
    request: Request,
    response: Response,
    client: VaultStorageClient = Depends(get_vault_storage_client),
) -> VaultItemResponse:
    try:
        return secret_vault_service.get_vault_item(item_id, client)
    except VaultUnavailableError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc


@router.post("/{item_id}/copy", response_model=VaultItemResponse)
@limiter.limit(settings.rate_limit_vault_copy)
def copy_vault_item(
    item_id: str,
    request: Request,
    response: Response,
    client: VaultStorageClient = Depends(get_vault_storage_client),
) -> VaultItemResponse:
    try:
        return secret_vault_service.consume_copy(item_id, client)
    except VaultUnavailableError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
