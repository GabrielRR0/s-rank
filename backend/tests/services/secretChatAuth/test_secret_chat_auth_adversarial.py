import base64
import json
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.services.secretChatAuth import secret_chat_auth_service
from app.services.secretChatAuth.errors import SessionTokenInvalidError

# Bateria de intentos de "hackeo" contra el esquema de tokens de
# secretChatAuth: forjar firma, tamperear el payload, reusar un token del
# tipo equivocado, el clasico ataque alg=none, e inyectar basura en room_id.
# Ninguno de estos deberia requerir cambios de codigo - documentan que las
# defensas ya presentes (PyJWT + los chequeos de secret_chat_auth_service)
# efectivamente los frenan.


def _room_id() -> str:
    return str(uuid.uuid4())


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def test_session_token_firmado_con_secreto_ajeno_es_rechazado(fake_chat_room_client):
    print("\n[test] refresh_access_token con un session_token firmado con OTRO secreto...")
    room_id = _room_id()
    now = datetime.now(timezone.utc)
    token_forjado = jwt.encode(
        {"token_type": "chat_session", "room_id": room_id, "iat": now, "exp": now + timedelta(seconds=60)},
        "un-secreto-que-el-atacante-inventa-a-mano",
        algorithm="HS256",
    )

    with pytest.raises(SessionTokenInvalidError):
        secret_chat_auth_service.refresh_access_token(room_id, token_forjado)
    print("[test] OK: firma invalida -> SessionTokenInvalidError, sin revelar por que fallo.")


def test_session_token_con_payload_alterado_a_mano_es_rechazado(fake_chat_room_client):
    print("\n[test] refresh_access_token con un session_token valido al que se le cambio el room_id sin resignar...")
    room_id_original = _room_id()
    room_id_objetivo = _room_id()
    inicial = secret_chat_auth_service.mint_initial_tokens(room_id_original, None, fake_chat_room_client)
    header_b64, payload_b64, firma_b64 = inicial["session_token"].split(".")

    payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
    payload["room_id"] = room_id_objetivo
    payload_alterado_b64 = _b64url(json.dumps(payload).encode())
    # Firma sin tocar: sigue siendo la de la sala original, ahora no
    # coincide con el payload alterado.
    token_alterado = f"{header_b64}.{payload_alterado_b64}.{firma_b64}"

    with pytest.raises(SessionTokenInvalidError):
        secret_chat_auth_service.refresh_access_token(room_id_objetivo, token_alterado)
    print("[test] OK: cambiar el room_id a mano invalida la firma -> SessionTokenInvalidError.")


def test_access_token_no_sirve_como_session_token(fake_chat_room_client):
    print("\n[test] refresh_access_token recibiendo un access_token (no un session_token) valido...")
    room_id = _room_id()
    inicial = secret_chat_auth_service.mint_initial_tokens(room_id, None, fake_chat_room_client)

    with pytest.raises(SessionTokenInvalidError):
        secret_chat_auth_service.refresh_access_token(room_id, inicial["access_token"])
    print("[test] OK: firma valida pero sin token_type='chat_session' -> igual rechazado.")


def test_session_token_con_alg_none_es_rechazado():
    print("\n[test] refresh_access_token con un token forjado con alg=none (sin firma)...")
    room_id = _room_id()
    now = datetime.now(timezone.utc)
    header = _b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    payload = _b64url(
        json.dumps(
            {
                "token_type": "chat_session",
                "room_id": room_id,
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(seconds=60)).timestamp()),
            }
        ).encode()
    )
    token_alg_none = f"{header}.{payload}."

    with pytest.raises(SessionTokenInvalidError):
        secret_chat_auth_service.refresh_access_token(room_id, token_alg_none)
    print("[test] OK: PyJWT rechaza alg=none (no esta en el algorithms=['HS256'] permitido) -> SessionTokenInvalidError.")


@pytest.mark.parametrize(
    "room_id_malicioso",
    [
        "../../etc/passwd",
        "'; DROP TABLE secret_chat_rooms; --",
        "",
        "a" * 5000,
        "sala\x00con-byte-nulo",
        "<script>alert(1)</script>",
        "  ",
        "00000000-0000-0000-0000-00000000000",  # UUID con un digito de menos
    ],
)
def test_room_id_malicioso_no_pasa_la_validacion(fake_chat_room_client, room_id_malicioso):
    print(f"\n[test] mint_initial_tokens con room_id malicioso: {room_id_malicioso!r}...")
    with pytest.raises(ValueError):
        secret_chat_auth_service.mint_initial_tokens(room_id_malicioso, None, fake_chat_room_client)
    print("[test] OK: rechazado con ValueError, nunca llego a firmar un token.")


def test_session_token_reutilizado_para_otra_sala_es_rechazado(fake_chat_room_client):
    # Ya cubierto en test_secret_chat_auth_service.py con otro nombre, se
    # repite aca en terminos de "intento de hackeo" explicito: alguien que
    # consiguio el session_token de la Sala A (ej. mirando el sessionStorage
    # de una PC compartida) intenta reusarlo contra la Sala B.
    print("\n[test] session_token valido de la Sala A usado para pedir acceso a la Sala B...")
    room_a = _room_id()
    room_b = _room_id()
    inicial = secret_chat_auth_service.mint_initial_tokens(room_a, None, fake_chat_room_client)

    with pytest.raises(SessionTokenInvalidError):
        secret_chat_auth_service.refresh_access_token(room_b, inicial["session_token"])
    print("[test] OK: el token de la Sala A no sirve para refrescar acceso a la Sala B.")


def test_jwt_secret_corto_sigue_firmando_pero_documenta_la_dependencia_de_configuracion(fake_chat_room_client, monkeypatch):
    # No es un ataque en si - documenta que la fortaleza real de todo este
    # esquema depende 100% de que SUPABASE_JWT_SECRET sea largo/aleatorio en
    # produccion (ver backend/README.md seccion 13). Con un secreto corto,
    # HS256 sigue "funcionando" tecnicamente, lo que en la practica lo
    # volveria fuerza-bruteable offline - responsabilidad de configuracion,
    # no de este codigo.
    print("\n[test] con SUPABASE_JWT_SECRET debil, el esquema sigue firmando (no es un chequeo de fortaleza)...")
    monkeypatch.setattr(settings, "supabase_jwt_secret", "123")
    room_id = _room_id()

    resultado = secret_chat_auth_service.mint_initial_tokens(room_id, None, fake_chat_room_client)

    assert resultado["access_token"]
    print("[test] Confirmado: ningun chequeo de fortaleza de secreto en codigo - depende de la configuracion del despliegue.")
