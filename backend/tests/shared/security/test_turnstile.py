import asyncio

import httpx

from app.config import settings
from app.shared.security.turnstile import verify_turnstile_token


def test_verify_turnstile_token_devuelve_true_si_esta_apagado(monkeypatch):
    print("\n[test] verify_turnstile_token con TURNSTILE_ENABLED=False (default)...")
    monkeypatch.setattr(settings, "turnstile_enabled", False)

    resultado = asyncio.run(verify_turnstile_token(None))

    assert resultado is True
    print("[test] OK: devolvio True sin llamar a Cloudflare, incluso sin token.")


def test_verify_turnstile_token_sin_token_falla_si_esta_prendido(monkeypatch):
    print("\n[test] verify_turnstile_token sin token, con TURNSTILE_ENABLED=True...")
    monkeypatch.setattr(settings, "turnstile_enabled", True)

    resultado = asyncio.run(verify_turnstile_token(None))

    assert resultado is False
    print("[test] OK: devolvio False sin necesitar llamar a Cloudflare (no hay token que mandar).")


def test_verify_turnstile_token_prendido_consulta_a_cloudflare(monkeypatch):
    print("\n[test] verify_turnstile_token con TURNSTILE_ENABLED=True y un token...")
    monkeypatch.setattr(settings, "turnstile_enabled", True)
    monkeypatch.setattr(settings, "turnstile_secret_key", "secreto-de-prueba")

    async def _mock_post(self, url, data=None, **kwargs):
        assert url == "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        assert data == {"secret": "secreto-de-prueba", "response": "token-valido"}
        return httpx.Response(200, json={"success": True}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", _mock_post)

    resultado = asyncio.run(verify_turnstile_token("token-valido"))

    assert resultado is True
    print("[test] OK: devolvio True a partir de una respuesta exitosa simulada de Cloudflare.")


def test_verify_turnstile_token_prendido_rechaza_respuesta_fallida(monkeypatch):
    print("\n[test] verify_turnstile_token con una respuesta fallida simulada de Cloudflare...")
    monkeypatch.setattr(settings, "turnstile_enabled", True)

    async def _mock_post(self, url, data=None, **kwargs):
        return httpx.Response(200, json={"success": False}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", _mock_post)

    resultado = asyncio.run(verify_turnstile_token("token-invalido"))

    assert resultado is False
    print("[test] OK: devolvio False.")
