from datetime import datetime

from pydantic import BaseModel

# Mismo criterio que ALLOWED_VAULT_TTL_SECONDS/ALLOWED_EXPIRATIONS_MINUTES:
# unica fuente de verdad server-side. Coincide con TTL_OPCIONES_SEGUNDOS del
# frontend (5 a 60s, las mismas opciones que ya existen para el TTL de
# mensajes de texto de una sala) - una imagen/audio efimero respeta el
# mismo autodestructivo que el resto de los mensajes de esa sala.
ALLOWED_CHAT_MEDIA_TTL_SECONDS = {5, 10, 15, 30, 45, 60}
ALLOWED_CHAT_MEDIA_MIME_PREFIXES = ("image/", "audio/")


class CreateChatMediaItemResponse(BaseModel):
    id: str
    expires_at: datetime


class ChatMediaItemResponse(BaseModel):
    id: str
    # Base64url del contenido cifrado (no el binario crudo) - mismo shape
    # que ya usa VaultItemResponse.ciphertext, para no necesitar un
    # endpoint de streaming binario aparte (ver
    # services/secretChatMedia/README.md).
    ciphertext: str
    nonce: str
    mime_type: str
    expires_at: datetime
