# schemas/sharedContent

Modelos Pydantic del dominio "contenido compartido" - la forma de los datos que entran y salen por HTTP, sin logica.

## Archivos

- **`shared_content_schemas.py`**: `CreateShareResponse` (lo que devuelve `POST /api/shared-content`), `ShareStatus` (lo que devuelve el `GET` de estado - nunca incluye el contenido real, solo si existe/requiere contraseña), `RevealRequest` (body del `POST .../reveal`) y `RevealedText` (respuesta JSON cuando el contenido es texto; los archivos se devuelven como `Response` binario directo desde el router, no como JSON - ver `routers/sharedContent/README.md`). Tambien define `ALLOWED_EXPIRATIONS_MINUTES`, la unica fuente de verdad server-side de que duraciones de expiracion son validas.

## Por que la creacion del share no tiene un schema Pydantic de request

`POST /api/shared-content` recibe `multipart/form-data` (obligatorio en cuanto hay un archivo de por medio - FastAPI no permite mezclar un body JSON con `UploadFile` en el mismo endpoint), asi que sus campos se declaran directo en el router con `Form(...)`/`File(...)` en vez de un `BaseModel`. `RevealRequest` si es JSON normal (el reveal nunca sube un archivo, solo manda la contraseña) y por eso si usa un modelo Pydantic como los demas.
