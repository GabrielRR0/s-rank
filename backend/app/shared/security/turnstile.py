import httpx

from app.config import settings

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(token: str | None) -> bool:
    """Valida el token de Turnstile contra la API de Cloudflare.

    Si TURNSTILE_ENABLED esta apagado (default), devuelve True sin llamar a
    nadie - Turnstile es una capa opcional que se activa explicitamente via
    variable de entorno (ver README), sin tocar codigo. Generico: usado por
    sharedContent y secretChatAuth por igual (ver shared/security/README.md).
    """
    if not settings.turnstile_enabled:
        return True

    if not token:
        return False

    async with httpx.AsyncClient(timeout=5.0) as http_client:
        response = await http_client.post(
            SITEVERIFY_URL,
            data={"secret": settings.turnstile_secret_key, "response": token},
        )
    return bool(response.json().get("success"))
