import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.services.secretChatAuth import secret_chat_auth_service
from app.services.secretChatAuth.errors import (
    JwtSecretMissingError,
    RoomAlreadyExistsError,
    RoomExpiredError,
    RoomPasswordInvalidError,
    SessionTokenInvalidError,
)


def _room_id() -> str:
    return str(uuid.uuid4())


def test_mint_initial_tokens_sin_password_devuelve_par_de_tokens(fake_chat_room_client):
    print("\n[test] mint_initial_tokens para una sala sin contraseña...")
    room_id = _room_id()

    result = secret_chat_auth_service.mint_initial_tokens(room_id, None, fake_chat_room_client)

    access_claims = jwt.decode(result["access_token"], settings.supabase_jwt_secret, algorithms=["HS256"])
    session_claims = jwt.decode(result["session_token"], settings.supabase_jwt_secret, algorithms=["HS256"])
    assert access_claims["role"] == "authenticated"
    assert access_claims["room_id"] == room_id
    assert "role" not in session_claims
    assert session_claims["token_type"] == "chat_session"
    print("[test] OK: access token con role=authenticated, session token sin role.")


def test_mint_initial_tokens_con_room_id_invalido_lanza_value_error(fake_chat_room_client):
    print("\n[test] mint_initial_tokens con room_id mal formado...")
    with pytest.raises(ValueError):
        secret_chat_auth_service.mint_initial_tokens("no-es-un-uuid", None, fake_chat_room_client)
    print("[test] OK: lanzo ValueError.")


def test_create_room_with_password_y_join_con_password_correcta(fake_chat_room_client):
    print("\n[test] create_room_with_password + mint_initial_tokens con la contraseña correcta...")
    room_id = _room_id()
    secret_chat_auth_service.create_room_with_password(room_id, "correcta123", fake_chat_room_client)

    result = secret_chat_auth_service.mint_initial_tokens(room_id, "correcta123", fake_chat_room_client)

    assert result["access_token"]
    print("[test] OK: se pudo unir con la contraseña correcta.")


def test_mint_initial_tokens_con_password_incorrecta_lanza_error(fake_chat_room_client):
    print("\n[test] mint_initial_tokens con contraseña incorrecta...")
    room_id = _room_id()
    secret_chat_auth_service.create_room_with_password(room_id, "correcta123", fake_chat_room_client)

    with pytest.raises(RoomPasswordInvalidError):
        secret_chat_auth_service.mint_initial_tokens(room_id, "incorrecta", fake_chat_room_client)
    print("[test] OK: lanzo RoomPasswordInvalidError.")


def test_mint_initial_tokens_sin_password_en_sala_protegida_lanza_error(fake_chat_room_client):
    print("\n[test] mint_initial_tokens sin mandar contraseña en una sala protegida...")
    room_id = _room_id()
    secret_chat_auth_service.create_room_with_password(room_id, "correcta123", fake_chat_room_client)

    with pytest.raises(RoomPasswordInvalidError):
        secret_chat_auth_service.mint_initial_tokens(room_id, None, fake_chat_room_client)
    print("[test] OK: lanzo RoomPasswordInvalidError.")


def test_create_room_with_password_duplicada_lanza_room_already_exists(fake_chat_room_client):
    print("\n[test] create_room_with_password dos veces con el mismo room_id...")
    room_id = _room_id()
    secret_chat_auth_service.create_room_with_password(room_id, "correcta123", fake_chat_room_client)

    with pytest.raises(RoomAlreadyExistsError):
        secret_chat_auth_service.create_room_with_password(room_id, "otra-contraseña", fake_chat_room_client)
    print("[test] OK: lanzo RoomAlreadyExistsError.")


def test_create_room_with_password_vacia_lanza_value_error(fake_chat_room_client):
    print("\n[test] create_room_with_password con contraseña vacia...")
    with pytest.raises(ValueError):
        secret_chat_auth_service.create_room_with_password(_room_id(), "", fake_chat_room_client)
    print("[test] OK: lanzo ValueError.")


def test_sala_con_password_vencida_se_purga_y_lanza_room_expired(fake_chat_room_client):
    print("\n[test] mint_initial_tokens contra una sala con contraseña ya vencida...")
    room_id = _room_id()
    secret_chat_auth_service.create_room_with_password(room_id, "correcta123", fake_chat_room_client)
    # Simula que ya paso SECRET_CHAT_ROOM_TTL_SECONDS sin tocar el reloj real.
    fake_chat_room_client.rows[room_id]["expires_at"] = (
        datetime.now(timezone.utc) - timedelta(seconds=1)
    ).isoformat()

    with pytest.raises(RoomExpiredError):
        secret_chat_auth_service.mint_initial_tokens(room_id, "correcta123", fake_chat_room_client)

    assert fake_chat_room_client.get_room(room_id) is None
    print("[test] OK: lanzo RoomExpiredError y purgo la fila - no revive con la password correcta.")


def test_refresh_access_token_con_session_token_valido(fake_chat_room_client):
    print("\n[test] refresh_access_token con un session_token valido...")
    room_id = _room_id()
    inicial = secret_chat_auth_service.mint_initial_tokens(room_id, None, fake_chat_room_client)

    result = secret_chat_auth_service.refresh_access_token(room_id, inicial["session_token"])

    claims = jwt.decode(result["access_token"], settings.supabase_jwt_secret, algorithms=["HS256"])
    assert claims["role"] == "authenticated"
    assert claims["room_id"] == room_id
    print("[test] OK: devolvio un access_token nuevo y valido.")


def test_refresh_access_token_con_room_id_distinto_lanza_error(fake_chat_room_client):
    print("\n[test] refresh_access_token con un room_id que no coincide con el del session_token...")
    room_id = _room_id()
    inicial = secret_chat_auth_service.mint_initial_tokens(room_id, None, fake_chat_room_client)

    with pytest.raises(SessionTokenInvalidError):
        secret_chat_auth_service.refresh_access_token(_room_id(), inicial["session_token"])
    print("[test] OK: lanzo SessionTokenInvalidError.")


def test_refresh_access_token_con_token_basura_lanza_error():
    print("\n[test] refresh_access_token con un token invalido...")
    with pytest.raises(SessionTokenInvalidError):
        secret_chat_auth_service.refresh_access_token(_room_id(), "esto-no-es-un-jwt")
    print("[test] OK: lanzo SessionTokenInvalidError.")


def test_refresh_access_token_con_session_token_vencido_lanza_error(fake_chat_room_client, monkeypatch):
    print("\n[test] refresh_access_token con un session_token ya vencido...")
    monkeypatch.setattr(settings, "realtime_session_ttl_seconds", -10)
    room_id = _room_id()
    inicial = secret_chat_auth_service.mint_initial_tokens(room_id, None, fake_chat_room_client)

    with pytest.raises(SessionTokenInvalidError):
        secret_chat_auth_service.refresh_access_token(room_id, inicial["session_token"])
    print("[test] OK: lanzo SessionTokenInvalidError.")


def test_mint_initial_tokens_sin_jwt_secret_configurado_lanza_error(fake_chat_room_client, monkeypatch):
    print("\n[test] mint_initial_tokens sin SUPABASE_JWT_SECRET configurada...")
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")

    with pytest.raises(JwtSecretMissingError):
        secret_chat_auth_service.mint_initial_tokens(_room_id(), None, fake_chat_room_client)
    print("[test] OK: lanzo JwtSecretMissingError.")
