from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile

from app.config import settings
from app.core.rate_limit import limiter
from app.schemas.secretChatMedia.secret_chat_media_schemas import ChatMediaItemResponse, CreateChatMediaItemResponse
from app.services.secretChatMedia import secret_chat_media_service
from app.services.secretChatMedia.errors import ChatMediaUnavailableError
from app.shared.storage.supabase_chat_media_client import ChatMediaStorageClient, get_chat_media_storage_client

router = APIRouter(prefix="/api/secret-chat-media", tags=["secret-chat-media"])


@router.post("", response_model=CreateChatMediaItemResponse, status_code=201)
@limiter.limit(settings.rate_limit_chat_media_create)
async def create_chat_media_item(
    request: Request,
    response: Response,
    room_id: str = Form(...),
    nonce: str = Form(...),
    mime_type: str = Form(...),
    ttl_seconds: int = Form(...),
    ciphertext_file: UploadFile = File(...),
    client: ChatMediaStorageClient = Depends(get_chat_media_storage_client),
) -> CreateChatMediaItemResponse:
    # multipart/form-data (no JSON): mismo motivo que shared_content_router -
    # FastAPI no permite mezclar un body JSON con UploadFile en el mismo
    # endpoint, y base64-en-JSON infla el payload ~33% arriesgando
    # max_body_bytes de forma innecesaria para algo que ya es binario.
    ciphertext_bytes = await ciphertext_file.read()
    try:
        return secret_chat_media_service.create_media_item(
            room_id=room_id,
            nonce=nonce,
            mime_type=mime_type,
            ttl_seconds=ttl_seconds,
            ciphertext_bytes=ciphertext_bytes,
            max_bytes=settings.chat_media_max_bytes,
            client=client,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/{item_id}", response_model=ChatMediaItemResponse)
@limiter.limit(settings.rate_limit_chat_media_status)
def get_chat_media_item(
    item_id: str,
    request: Request,
    response: Response,
    client: ChatMediaStorageClient = Depends(get_chat_media_storage_client),
) -> ChatMediaItemResponse:
    try:
        return secret_chat_media_service.get_media_item(item_id, client)
    except ChatMediaUnavailableError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
