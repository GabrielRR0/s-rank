from datetime import datetime

from pydantic import BaseModel

# Igual criterio que ALLOWED_EXPIRATIONS_MINUTES en sharedContent: unica
# fuente de verdad server-side, el frontend ofrece las mismas opciones por
# UX pero el backend nunca confia en un valor que no este en estos sets (ver
# services/secretVault/secret_vault_service.py).
ALLOWED_VAULT_MAX_COPIES = set(range(1, 7))  # 1 a 6 copias
ALLOWED_VAULT_TTL_SECONDS = {30, 45, 60}
# Los items de imagen/audio (content_type != "text") reutilizan el resto
# de este archivo tal cual - mismos limites de copias/TTL, mismo shape de
# respuesta - ver services/secretVault/README.md. "text" no esta en este
# set porque tiene su propio endpoint (POST /api/secret-vault, sin content_type
# en el body) - este set es solo para POST /api/secret-vault/media.
ALLOWED_VAULT_MEDIA_CONTENT_TYPES = {"image", "audio"}


class CreateVaultItemRequest(BaseModel):
    # El backend nunca ve la clave de la sala ni el plaintext - esto ya
    # llega cifrado en el cliente (ver frontend/src/services/secretChat/crypto.service.ts).
    ciphertext: str
    nonce: str
    max_copies: int
    ttl_seconds: int
    room_id: str | None = None


class VaultItemResponse(BaseModel):
    id: str
    # None solo puede pasar transitoriamente del lado de la fila cruda (un
    # item de imagen/audio la guarda en NULL, el contenido vive en Storage) -
    # get_vault_item siempre lo rellena antes de construir esta respuesta,
    # asi que quien consume la API nunca ve null aca en la practica.
    ciphertext: str | None
    nonce: str
    max_copies: int
    remaining_copies: int
    expires_at: datetime
    content_type: str = "text"
    mime_type: str | None = None


class CreateVaultItemResponse(BaseModel):
    id: str
    expires_at: datetime
