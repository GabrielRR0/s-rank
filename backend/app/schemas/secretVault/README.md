# schemas/secretVault

Modelos Pydantic del Cofre del chat secreto S-Rank — la forma de los datos que entran y salen por HTTP, sin lógica.

## Archivos

- **`secret_vault_schemas.py`**: `CreateVaultItemRequest` (body JSON de `POST /api/secret-vault`, solo texto), `CreateVaultItemResponse` (id + `expires_at`, compartida por ambos endpoints de creación), `VaultItemResponse` (lo que devuelven el `GET` y el `POST .../copy` — incluye `remaining_copies`, `content_type`, `mime_type`; `ciphertext` es nullable porque un item de imagen/audio lo deja `NULL` en la fila cruda, aunque `get_vault_item` siempre lo rellena antes de responder). No hay un `CreateVaultMediaItemRequest`: el body de `POST /api/secret-vault/media` es `multipart/form-data` (`Form(...)` + `UploadFile`), no JSON. También define `ALLOWED_VAULT_MAX_COPIES` (1 a 6), `ALLOWED_VAULT_TTL_SECONDS` (30/45/60) y `ALLOWED_VAULT_MEDIA_CONTENT_TYPES` (`image`/`audio`, solo para el endpoint `/media`) — únicas fuentes de verdad server-side de qué valores son válidos, mismo criterio que `ALLOWED_EXPIRATIONS_MINUTES` en `schemas/sharedContent/`.
