# services/secretVault

Orquestación del Cofre del chat secreto S-Rank. Ver `backend/README.md` sección 12 para el panorama completo.

## Archivos

- **`secret_vault_service.py`**: `create_vault_item` (texto — valida `max_copies`/`ttl_seconds` contra los allowlists de `schemas/secretVault/secret_vault_schemas.py`, guarda el ciphertext ya cifrado en el cliente inline en la fila), `create_vault_media_item` (imagen/audio — mismas validaciones más `content_type`/`mime_type`, sube el ciphertext a Storage en vez de guardarlo inline, `ciphertext` queda `NULL` en la fila), `get_vault_item` (lectura sin consumir nada — a diferencia de `sharedContent`, ver el item no está limitado; para items de imagen/audio descarga de Storage y lo codifica en base64url en el mismo campo `ciphertext` de siempre), `consume_copy` (decrementa atómicamente vía `VaultStorageClient.decrement_copies_if_available`, purga la fila — y el archivo de Storage, si lo tenía — si llega a 0).
- **`errors.py`**: `VaultUnavailableError` — único tipo de error para "no existe / expiró / agotó sus copias", igual criterio que `ShareUnavailableError` en `sharedContent`. El router la traduce a `410`.
- **`cleanup/expire_on_access.py`**: `is_expired`/`purge_item`/`raise_if_expired`, chequeo on-demand en cada acceso — sin worker en segundo plano (regla del portafolio: cero colas/workers 24/7), mismo patrón que `services/sharedContent/cleanup/`. `purge_item` borra el archivo de Storage antes que la fila, si el item tenía uno (`storage_path`) — idempotente si ya no existe.

## Por qué este servicio nunca cifra ni descifra nada

A diferencia de `services/sharedContent/security/encryption.py` (que cifra con `MASTER_ENCRYPTION_KEY`, una clave que el backend sí conoce), el Cofre recibe `ciphertext`/`nonce` ya cifrados en el navegador con la clave de la sala — que vive solo en el fragmento de la URL (`#hash`) y nunca viaja en ningún request HTTP. Si este servicio reutilizara `encryption.py`, el backend vería el secreto en texto plano en cada `create`/`copy` — exactamente lo que el diseño de cifrado de extremo a extremo del chat busca evitar para su dato más sensible. Por eso `secretVault` no importa nada de `services/sharedContent/` y trata el `ciphertext` como un blob opaco de principio a fin.
