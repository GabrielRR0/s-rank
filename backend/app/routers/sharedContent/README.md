# routers/sharedContent

Capa HTTP del dominio "contenido compartido" - validacion de forma y traduccion de errores a codigos HTTP, sin logica de negocio (esa vive en `services/sharedContent/`).

## Endpoints

- **`POST /api/shared-content`**: crea un share. Recibe `multipart/form-data` (`content_type`, `text` o `file`, `password` opcional, `expires_in_minutes`). `ValueError` del servicio (dato invalido, archivo demasiado grande, expiracion no permitida) -> `422` con el mensaje real.
- **`GET /api/shared-content/{id}`**: estado del link (existe / requiere contraseña / tipo de contenido), sin revelar nada ni consumir la vista unica. Siempre `200`, incluso si el id no existe o expiro (`exists: false`) - no es un error, es el resultado esperado para un link muerto.
- **`POST /api/shared-content/{id}/reveal`**: la unica accion que efectivamente entrega el contenido y quema la vista unica. `ShareUnavailableError` (no existe / expiro / ya fue visto) -> `410 Gone`. `ShareUnauthorizedError` (contraseña incorrecta) -> `401`, sin quemar la vista - el destinatario real puede reintentar.

## Por que `reveal` devuelve a veces JSON y a veces un `Response` binario

Si el share es de texto, devuelve `RevealedText` (JSON). Si es de archivo, devuelve un `Response` con el contenido binario crudo y `Content-Disposition: attachment` - el navegador lo descarga directo, sin que el frontend tenga que decodificar base64. `shared_content_service.reveal_share` ya distingue los dos casos por su tipo de retorno (ver su propio README); este router solo decide como serializar cada uno.

## Por que `client: StorageClient = Depends(get_storage_client)` en vez de importar el cliente real directo

A diferencia de `contracts_router.py` en `contract-generator` (que llama a `contract_service` sin ningun `Depends`, porque no tiene ninguna dependencia externa que mockear), este dominio si depende de Supabase. Usar la inyeccion de dependencias de FastAPI permite que los tests reemplacen el cliente real por un fake en memoria para toda la sesion de `TestClient` (`app.dependency_overrides`, ver `tests/conftest.py`) sin tocar una linea del router ni del servicio.
