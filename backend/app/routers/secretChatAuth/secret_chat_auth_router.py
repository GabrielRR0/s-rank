from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.config import settings
from app.core.rate_limit import get_client_ip, limiter
from app.schemas.secretChatAuth.secret_chat_auth_schemas import (
    CreateRoomRequest,
    InitialTokenResponse,
    RealtimeTokenRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
)
from app.services.secretChatAuth import bot_guard, secret_chat_auth_service
from app.services.secretChatAuth.errors import (
    RoomAlreadyExistsError,
    RoomExpiredError,
    RoomPasswordInvalidError,
    SessionTokenInvalidError,
)
from app.shared.security.turnstile import verify_turnstile_token
from app.shared.storage.supabase_chat_rooms_client import ChatRoomStorageClient, get_chat_room_storage_client

router = APIRouter(prefix="/api/secret-chat", tags=["secret-chat-auth"])


async def _require_turnstile_or_block(request: Request, token: str | None) -> None:
    ip = get_client_ip(request)
    if bot_guard.is_blocked(ip):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Probá de nuevo más tarde.")
    if not await verify_turnstile_token(token):
        bot_guard.register_failure(ip)
        raise HTTPException(status_code=422, detail="Verificación anti-bot fallida.")


@router.post("/rooms", response_model=InitialTokenResponse, status_code=201)
@limiter.limit(settings.rate_limit_realtime_rooms)
async def create_room(
    request: Request,
    response: Response,
    body: CreateRoomRequest,
    client: ChatRoomStorageClient = Depends(get_chat_room_storage_client),
) -> InitialTokenResponse:
    await _require_turnstile_or_block(request, body.turnstile_token)
    try:
        return secret_chat_auth_service.create_room_with_password(body.room_id, body.password, client)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RoomAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/realtime-token", response_model=InitialTokenResponse)
@limiter.limit(settings.rate_limit_realtime_token)
async def get_realtime_token(
    request: Request,
    response: Response,
    body: RealtimeTokenRequest,
    client: ChatRoomStorageClient = Depends(get_chat_room_storage_client),
) -> InitialTokenResponse:
    await _require_turnstile_or_block(request, body.turnstile_token)
    try:
        return secret_chat_auth_service.mint_initial_tokens(body.room_id, body.password, client)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RoomPasswordInvalidError as exc:
        bot_guard.register_failure(get_client_ip(request))
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except RoomExpiredError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc


@router.post("/realtime-token/refresh", response_model=RefreshTokenResponse)
@limiter.limit(settings.rate_limit_realtime_refresh)
def refresh_realtime_token(
    request: Request,
    response: Response,
    body: RefreshTokenRequest,
) -> RefreshTokenResponse:
    try:
        return secret_chat_auth_service.refresh_access_token(body.room_id, body.session_token)
    except SessionTokenInvalidError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
