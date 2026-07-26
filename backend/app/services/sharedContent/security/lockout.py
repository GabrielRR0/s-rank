from app.shared.storage.supabase_client import StorageClient


def register_failed_attempt(share_id: str, max_attempts: int, client: StorageClient) -> bool:
    """Registra un intento de contraseña incorrecta contra este share
    puntual y devuelve True si con este intento se alcanzo o supero
    `max_attempts` (el llamador debe purgar el share en ese caso).

    A diferencia de mark_viewed_if_unseen (que exige atomicidad real porque
    una carrera ahi significaria que dos personas ven el contenido), un
    incremento perdido aca en una carrera improbable solo le regala un
    intento extra a un atacante - no una fuga de contenido - asi que no
    hace falta la misma garantia de UPDATE atomico via SQL/RPC, un simple
    incremento alcanza.
    """
    attempts = client.increment_failed_attempts(share_id)
    return attempts >= max_attempts
