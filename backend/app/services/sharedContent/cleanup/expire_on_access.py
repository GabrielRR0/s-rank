from datetime import datetime, timezone

from app.services.sharedContent.errors import ShareUnavailableError
from app.shared.storage.supabase_client import StorageClient


def is_expired(share: dict) -> bool:
    expires_at = share["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    return datetime.now(timezone.utc) >= expires_at


def purge_share(share: dict, client: StorageClient) -> None:
    """Borra fisicamente el recurso: el archivo en Storage (si el share es
    de tipo archivo) y la fila de metadata en Postgres - nunca un soft
    delete. Se llama tanto cuando un share expira sin haber sido visto
    nunca (`raise_if_expired`) como despues de servir con exito una vista
    unica (`shared_content_service.reveal_share`)."""
    if share.get("storage_path"):
        client.delete_file(share["storage_path"])
    client.delete_share_row(share["id"])


def raise_if_expired(share: dict, client: StorageClient) -> None:
    """Chequeo on-demand: no hay ningun worker en segundo plano barriendo la
    tabla en busca de filas vencidas (regla del portafolio: cero colas/workers
    24/7). Un share que expira y nadie vuelve a abrir su link simplemente
    queda en Supabase hasta que alguien lo intente abrir - en ese momento
    esta funcion lo detecta y lo purga recien ahi."""
    if is_expired(share):
        purge_share(share, client)
        raise ShareUnavailableError(f"El contenido '{share['id']}' expiro.")
