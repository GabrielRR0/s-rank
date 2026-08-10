# routers/secretChatMedia

Capa HTTP de las imágenes/audio del chat secreto enviados como mensaje normal (no el Cofre). Ver `backend/README.md` sección 15.

## Endpoints

- **`POST /api/secret-chat-media`**: crea un item. `multipart/form-data` (no JSON) — mismo motivo que `shared_content_router.create_share`: FastAPI no permite mezclar un body JSON con `UploadFile` en el mismo endpoint, y base64-en-JSON infla el payload ~33% arriesgando `max_body_bytes` para algo que ya es binario. Campos: `room_id`, `nonce`, `mime_type`, `ttl_seconds`, `ciphertext_file` (los bytes ya cifrados en el cliente). `ValueError` del servicio -> `422`.
- **`GET /api/secret-chat-media/{id}`**: devuelve `{ id, ciphertext (base64url), nonce, mime_type, expires_at }` si no expiró. A diferencia de la subida, la bajada sí puede ser JSON con el contenido en base64 — el middleware `reject_oversized_body` de `main.py` solo mide el `Content-Length` del *request* entrante, nunca el tamaño de la respuesta. `ChatMediaUnavailableError` -> `410 Gone`.
