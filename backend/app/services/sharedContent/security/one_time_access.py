from app.services.sharedContent.errors import ShareUnavailableError
from app.shared.storage.supabase_client import StorageClient


def consume_view(share_id: str, client: StorageClient) -> dict:
    """Marca el share como visto de forma atomica (ver
    SupabaseStorageClient.mark_viewed_if_unseen) y devuelve la fila
    resultante - todavia con el contenido original (`content_text` /
    `storage_path`), porque esta operacion solo toca `viewed_at`.

    Si ya estaba visto (o nunca existio), no hay una segunda oportunidad:
    se lanza ShareUnavailableError. Quien llama a esta funcion debe haber
    validado ya la contraseña (si aplica) antes de invocarla - ver
    shared_content_service.reveal_share.
    """
    row = client.mark_viewed_if_unseen(share_id)
    if row is None:
        raise ShareUnavailableError(f"El contenido '{share_id}' ya fue visto o no existe.")
    return row
