class JwtSecretMissingError(Exception):
    """SUPABASE_JWT_SECRET no esta configurada - ver backend/README.md
    seccion 13. Deliberadamente sin capturar en ningun lado (mismo criterio
    que EncryptionKeyError): un despliegue mal configurado debe fallar
    fuerte (500), no mintear tokens con un secreto vacio."""


class RoomAlreadyExistsError(Exception):
    """Ya existe una sala registrada con ese room_id (create_room_with_password
    llamado dos veces para el mismo id). El router la traduce a 409."""


class RoomExpiredError(Exception):
    """La sala tenia contraseña pero ya vencio su ventana (SECRET_CHAT_ROOM_TTL_SECONDS)
    - se purgo en el momento del intento de acceso y ya no admite conexiones,
    ni siquiera con la contraseña correcta. El router la traduce a 410."""


class RoomPasswordInvalidError(Exception):
    """La sala tiene contraseña y la que se mando no coincide (o falta).
    Retryable - a diferencia de RoomExpiredError, quien pide el token puede
    reintentar con la contraseña correcta. El router la traduce a 401."""


class SessionTokenInvalidError(Exception):
    """El session_token no es valido, no es del tipo esperado, no
    corresponde a esta sala, o ya vencio. El router la traduce a 401 - el
    frontend lo interpreta como 'hay que resolver Turnstile de nuevo'."""
