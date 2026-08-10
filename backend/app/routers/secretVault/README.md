# routers/secretVault

Capa HTTP del Cofre del chat secreto S-Rank - validación de forma y traducción de errores a códigos HTTP, sin lógica de negocio (esa vive en `services/secretVault/`). Ver `backend/README.md` sección 12 para el panorama completo (por qué existe este dominio, SQL de la tabla/función, asimetría con el chat sin protección de servidor).

## Endpoints

- **`POST /api/secret-vault`**: crea un item de **texto**. Recibe JSON (`ciphertext`, `nonce`, `max_copies` 1-6, `ttl_seconds`, `room_id` opcional) — ambos ya generados/cifrados en el cliente, este router nunca ve la clave de la sala. `ValueError` del servicio (valores fuera de los allowlists permitidos) -> `422`.
- **`POST /api/secret-vault/media`**: mismo item pero de **imagen o audio** — `multipart/form-data` en vez de JSON (FastAPI no permite mezclar un body JSON con `UploadFile` en el mismo endpoint, mismo motivo que `shared_content_router.create_share`). Campos: `content_type` (`image`/`audio`), `mime_type`, `max_copies`, `ttl_seconds`, `nonce`, `room_id` opcional, `ciphertext_file`. `ValueError` -> `422`.
- **`GET /api/secret-vault/{id}`**: devuelve el item si no expiró ni se agotó. A diferencia de `sharedContent`, ver el item **no** consume nada — solo copiarlo lo hace (ver el endpoint de abajo). Para items de imagen/audio, descarga de Storage y codifica el contenido en base64url en el mismo campo `ciphertext`. `VaultUnavailableError` -> `410 Gone`.
- **`POST /api/secret-vault/{id}/copy`**: decrementa el contador de copias de forma atómica y devuelve la fila resultante; si llega a 0, la fila (y el archivo de Storage, si lo tenía) ya no existe después de esta llamada (autodestrucción inmediata). `VaultUnavailableError` (no existe / expiró / ya agotado) -> `410 Gone`.

## Por qué `client: VaultStorageClient = Depends(get_vault_storage_client)`

Mismo motivo que `shared_content_router.py`: permite que los tests reemplacen el cliente real de Supabase por un fake en memoria (`app.dependency_overrides`, ver `tests/conftest.py`) para toda la sesión de `TestClient`, sin tocar el router ni el servicio.
