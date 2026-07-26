from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings


def get_client_ip(request: Request) -> str:
    """IP real del cliente para usar como clave del rate limiter.

    En Vercel (y cualquier deploy detras de un proxy/edge confiable) la
    conexion TCP que llega al proceso es la del proxy, no la del cliente;
    `request.client.host` seria siempre la misma IP interna y el rate limit
    terminaria compartido por todos los usuarios. Vercel no puede bypassearse
    (no hay forma de pegarle a la funcion sin pasar por su edge), asi que su
    header `X-Forwarded-For` es confiable. Si en el futuro esto corre detras
    de otro proxy que no sanitiza ese header, hay que revisar este supuesto.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(
    key_func=get_client_ip,
    storage_uri=settings.rate_limit_storage_uri,
    headers_enabled=True,
)
