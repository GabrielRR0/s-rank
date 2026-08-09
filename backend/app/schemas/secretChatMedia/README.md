# schemas/secretChatMedia

Modelos Pydantic de las imágenes/audio del chat secreto enviados como mensaje normal (no el Cofre).

## Archivos

- **`secret_chat_media_schemas.py`**: `CreateChatMediaItemResponse` (id + `expires_at`), `ChatMediaItemResponse` (lo que devuelve el `GET`). Define `ALLOWED_CHAT_MEDIA_TTL_SECONDS` (5 a 60, mismas opciones que ya existen para el TTL de texto de una sala) y `ALLOWED_CHAT_MEDIA_MIME_PREFIXES` (`image/`, `audio/`) — únicas fuentes de verdad server-side. No hay un `CreateChatMediaItemRequest`: el body de creación es `multipart/form-data` (`Form(...)` + `UploadFile`), no JSON — ver `routers/secretChatMedia/README.md`.
