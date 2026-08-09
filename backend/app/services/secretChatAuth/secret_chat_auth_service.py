import uuid
from datetime import datetime, timedelta, timezone

import jwt
from postgrest.exceptions import APIError

from app.config import settings
from app.services.secretChatAuth.cleanup.expire_on_access import get_active_room
from app.services.secretChatAuth.errors import (
    JwtSecretMissingError,
    RoomAlreadyExistsError,
    RoomPasswordInvalidError,
    SessionTokenInvalidError,
)
from app.shared.security.password_hash import hash_password, verify_password
from app.shared.storage.supabase_chat_rooms_client import ChatRoomStorageClient

# Token de "capacidad", no de identidad (ver Contexto del plan): quien lo
# tenga puede actuar como `authenticated` para esa sala puntual, sin ningun
# claim que identifique a la persona - coherente con el diseño sin cuentas
# del resto del proyecto.
ACCESS_ROLE = "authenticated"
# Deliberadamente SIN role:authenticated - nunca debe servir como
# credencial de Realtime aunque se filtre, solo prueba "resolvio Turnstile
# hace poco para esta sala" (ver refresh_access_token).
SESSION_TOKEN_TYPE = "chat_session"


def _load_jwt_secret() -> str:
    # Perezoso (no a nivel de modulo): mismo criterio que
    # encryption._load_key() - si se cargara al importar este archivo,
    # correr pytest sin SUPABASE_JWT_SECRET configurada rompería la
    # coleccion de tests que no ejercitan este camino.
    if not settings.supabase_jwt_secret:
        raise JwtSecretMissingError(
            "SUPABASE_JWT_SECRET no esta configurada - ver backend/README.md, seccion 13."
        )
    return settings.supabase_jwt_secret


def _validate_room_id(room_id: str) -> None:
    try:
        uuid.UUID(room_id)
    except ValueError as exc:
        raise ValueError("room_id invalido.") from exc


def _sign_access_token(room_id: str) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.realtime_access_ttl_seconds)
    payload = {"role": ACCESS_ROLE, "room_id": room_id, "iat": now, "exp": expires_at}
    token = jwt.encode(payload, _load_jwt_secret(), algorithm="HS256")
    return token, expires_at


def _sign_session_token(room_id: str) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.realtime_session_ttl_seconds)
    payload = {"token_type": SESSION_TOKEN_TYPE, "room_id": room_id, "iat": now, "exp": expires_at}
    token = jwt.encode(payload, _load_jwt_secret(), algorithm="HS256")
    return token, expires_at


def _mint_token_pair(room_id: str) -> dict:
    access_token, access_expires_at = _sign_access_token(room_id)
    session_token, session_expires_at = _sign_session_token(room_id)
    return {
        "access_token": access_token,
        "access_expires_at": access_expires_at,
        "session_token": session_token,
        "session_expires_at": session_expires_at,
    }


def mint_initial_tokens(room_id: str, password: str | None, client: ChatRoomStorageClient) -> dict:
    """Usado por quien se une a cualquier sala, y por quien crea una sala
    SIN contraseña. Si la sala tiene fila en secret_chat_rooms, exige y
    verifica la contraseña antes de mintear nada - RoomExpiredError (sala
    vencida) y RoomPasswordInvalidError (contraseña incorrecta) se dejan
    propagar, las traduce el router."""
    _validate_room_id(room_id)

    room = get_active_room(room_id, client)
    if room is not None:
        if not password or not verify_password(password, room["password_hash"]):
            raise RoomPasswordInvalidError("Contraseña incorrecta.")

    return _mint_token_pair(room_id)


def create_room_with_password(room_id: str, password: str, client: ChatRoomStorageClient) -> dict:
    """Usado solo por quien crea una sala CON contraseña. Registra la fila
    y, en la misma llamada, mintea el primer par de tokens - evita que el
    creador tenga que resolver Turnstile dos veces seguidas."""
    _validate_room_id(room_id)
    if not password:
        raise ValueError("La contraseña no puede estar vacia.")

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.secret_chat_room_ttl_seconds)
    record = {
        "id": room_id,
        "password_hash": hash_password(password),
        "expires_at": expires_at.isoformat(),
    }
    try:
        client.insert_room(record)
    except APIError as exc:
        # "23505" es el codigo SQL estandar de unique_violation - el UNICO
        # caso que se traduce a 409. Cualquier otro APIError (ej. la tabla
        # secret_chat_rooms todavia no existe en Supabase, PGRST205) debe
        # propagarse tal cual y terminar en 500: capturarlo todo bajo
        # RoomAlreadyExistsError mentiria sobre la causa real y ocultaria
        # un problema de configuracion real (ver backend/README.md seccion 14).
        if exc.code == "23505":
            raise RoomAlreadyExistsError(f"La sala '{room_id}' ya existe.") from exc
        raise

    return _mint_token_pair(room_id)


def refresh_access_token(room_id: str, session_token: str) -> dict:
    """Sin Turnstile, sin contraseña - la garantia real ya la dio el
    session_token en su momento (ver mint_initial_tokens/create_room_with_password).
    Su propio `exp` es el limite: no hace falta comparar ningun timestamp
    aparte, jwt.decode ya lanza si vencio."""
    try:
        payload = jwt.decode(session_token, _load_jwt_secret(), algorithms=["HS256"])
    except jwt.InvalidTokenError as exc:
        raise SessionTokenInvalidError("session_token invalido o vencido.") from exc

    if payload.get("token_type") != SESSION_TOKEN_TYPE or payload.get("room_id") != room_id:
        raise SessionTokenInvalidError("session_token invalido para esta sala.")

    access_token, access_expires_at = _sign_access_token(room_id)
    return {"access_token": access_token, "access_expires_at": access_expires_at}
