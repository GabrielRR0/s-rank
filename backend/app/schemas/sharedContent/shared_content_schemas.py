from datetime import datetime

from pydantic import BaseModel

# Duraciones permitidas (en minutos) para la expiracion de un share. Unica
# fuente de verdad server-side; el frontend ofrece las mismas opciones en
# ExpirationSelector.vue por UX, pero el backend nunca confia en un valor de
# expiracion que no este en este set (ver shared_content_service.create_share).
# Techo de 24hs a proposito: el contenido que maneja este proyecto es
# delicado y se espera que el destinatario lo vea casi de inmediato, no que
# quede disponible dias enteros "por las dudas".
ALLOWED_EXPIRATIONS_MINUTES = {10, 60, 60 * 6, 60 * 24}


class CreateShareResponse(BaseModel):
    id: str
    # Ruta relativa (no URL absoluta): el backend no conoce con certeza el
    # dominio publico del frontend en cada request, y no hace falta - el
    # frontend arma la URL completa con su propio origin (ver sharing.service.ts).
    url_path: str
    expires_at: datetime


class ShareStatus(BaseModel):
    exists: bool
    requires_password: bool = False
    content_type: str | None = None
    file_name: str | None = None


class RevealRequest(BaseModel):
    password: str | None = None


class RevealedText(BaseModel):
    content_type: str = "text"
    text: str
