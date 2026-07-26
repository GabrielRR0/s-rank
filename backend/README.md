# Backend — File Sharer (FastAPI)

API que comparte texto o un archivo detrás de un enlace temporal, de visualización única. Todo el procesamiento ocurre dentro de la misma request HTTP (sin colas, sin workers en segundo plano), para que funcione en un hosting serverless gratuito sin cold-starts largos.

## 1. Qué hace este backend, en una línea

Recibe texto o un archivo (`POST /api/shared-content`) y devuelve un id de enlace; ese enlace sirve el contenido **una sola vez** (`POST /api/shared-content/{id}/reveal`) y lo borra físicamente después, o al expirar el tiempo elegido — lo que ocurra primero.

## 2. Requisitos

- Python 3.12+ instalado (`python --version` para verificar).
- Un proyecto gratuito en [Supabase](https://supabase.com) (Postgres + Storage) — a diferencia de `contract-generator`, este backend sí necesita persistencia externa desde el primer request: en un hosting serverless el filesystem no sobrevive entre invocaciones, y el archivo subido en un request tiene que poder leerse desde otro. Ver sección 8 para el setup exacto.

## 3. Cómo ejecutarlo paso a paso

Todos los comandos se corren **desde la carpeta `backend/`**.

### 3.1 Crear el entorno virtual (solo la primera vez)

```
python -m venv .venv
```

### 3.2 Activar el entorno virtual (cada vez que abras una terminal nueva)

**PowerShell** (el prompt empieza con `PS `):
```powershell
.venv\Scripts\Activate.ps1
```
Si da un error de "la ejecución de scripts está deshabilitada en este sistema":
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
y volver a intentar `.venv\Scripts\Activate.ps1`.

**cmd.exe**: `.venv\Scripts\activate.bat`

**Git Bash / bash**: `source .venv/Scripts/activate`

**Alternativa a prueba de fallos** (sin activar nada): invocar siempre el ejecutable de `.venv` explícito:
```
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 3.3 Instalar las dependencias

```
pip install -r requirements.txt
```

### 3.4 Configurar Supabase

1. Crear un proyecto gratuito en [supabase.com](https://supabase.com).
2. En **SQL Editor**, crear la tabla:
   ```sql
   create table shared_content (
     id uuid primary key,
     content_type text not null,
     content_text text,
     storage_path text,
     file_name text,
     file_size integer,
     file_type text,
     password_hash text,
     expires_at timestamptz not null,
     viewed_at timestamptz,
     created_at timestamptz not null default now()
   );
   alter table shared_content enable row level security;
   -- Sin políticas públicas a propósito: el backend accede con la service
   -- role key (bypassea RLS); el frontend nunca habla directo con Supabase.
   ```
3. En **Storage**, crear un bucket privado llamado `shared-content`.
4. En **Project Settings → API**, copiar la **URL** y la **service_role key** (no la `anon` key — el backend borra objetos de Storage, algo que la key pública no puede hacer).
5. Copiar `.env.example` a `.env` y completar `SUPABASE_URL` / `SUPABASE_KEY` con esos valores.

### 3.5 Levantar el servidor

```
uvicorn app.main:app --reload --port 8000
```

Probarlo sin el frontend en `http://localhost:8000/docs` (Swagger UI autogenerado).

## 4. Cómo correr los tests

```
pytest
```

**No hace falta Supabase configurado para correr los tests** — reemplazan el cliente real por un fake en memoria (ver `tests/conftest.py` y `app/shared/storage/README.md`). Si ves `ModuleNotFoundError: No module named 'app'`, el venv no está activo (ver 3.2); para descartarlo: `.venv\Scripts\python.exe -m pytest`.

## 5. Estructura del proyecto

```
app/
  main.py                       # entrypoint: FastAPI, middlewares, CORS, router
  config.py                     # configuración vía variables de entorno (.env)
  core/rate_limit.py            # slowapi Limiter
  routers/sharedContent/        # capa HTTP -> ver README.md de la carpeta
  services/sharedContent/       # orquestación, seguridad, cleanup -> ver README.md de la carpeta
  schemas/sharedContent/        # validación de datos (Pydantic) -> ver README.md de la carpeta
  shared/storage/                # cliente de Supabase -> ver README.md de la carpeta
tests/                          # espejo de app/, un archivo de test por módulo con lógica
pytest.ini
requirements.txt
.env.example
```

Sin `__init__.py` en estas carpetas (namespace packages implícitos), mismo criterio que `contract-generator` — cada carpeta con lógica real tiene su propio `README.md`.

## 6. Flujo interno (de la subida al borrado)

1. `POST /api/shared-content`: `shared_content_router` recibe `multipart/form-data` y llama a `shared_content_service.create_share`. Si es texto, se guarda directo en Postgres; si es archivo, se sube a Supabase Storage y solo la ruta queda en Postgres. Devuelve `{id, url_path, expires_at}`.
2. El destinatario abre `/s/{id}` en el frontend, que hace `GET /api/shared-content/{id}` — informa si existe, si expiró y si pide contraseña, **sin revelar nada ni consumir la vista** (para no quemarla con un simple `GET`, ver `services/sharedContent/security/README.md`).
3. Al confirmar (y dar la contraseña si hace falta), el frontend llama a `POST /api/shared-content/{id}/reveal`. El servicio valida la contraseña contra el hash, marca `viewed_at` de forma atómica (`UPDATE ... WHERE viewed_at IS NULL`, ver `app/shared/storage/supabase_client.py`), lee el contenido y **recién ahí** borra el archivo de Storage y la fila de Postgres.

## 7. Variables de entorno

Copiar `.env.example` a `.env`:

- `SUPABASE_URL` / `SUPABASE_KEY`: credenciales del proyecto de Supabase (ver sección 3.4). Sin esto, cualquier endpoint que toque storage falla — a diferencia de `contract-generator`, acá no son opcionales.
- `SUPABASE_STORAGE_BUCKET`: nombre del bucket (default `shared-content`).
- `FRONTEND_URL`: URL del frontend en producción, sumada a CORS junto a `http://localhost:5173` (siempre permitido en dev).
- `RATE_LIMIT_CREATE` / `RATE_LIMIT_STATUS` / `RATE_LIMIT_REVEAL`: límites por IP (ver sección 9).
- `RATE_LIMIT_STORAGE_URI`: `memory://` alcanza para un proceso; en serverless con varias instancias, apuntar a Redis (Upstash) para un límite realmente global.
- `MAX_BODY_BYTES` / `MAX_FILE_BYTES`: techo de tamaño de request / de archivo (10MB de negocio, con margen extra en el body para el overhead de multipart).

## 8. Sobre Supabase (por qué es obligatorio acá y no en `contract-generator`)

En `contract-generator`, `shared/storage/` quedó vacía a propósito porque el PDF se genera y se descarga en la misma request, sin necesitar persistencia. Acá el archivo se sube en un request y se descarga en otro — potencialmente en otra instancia del backend en un hosting serverless — así que necesita vivir en un storage externo compartido desde el día uno. Es, dentro del portafolio, el primer proyecto que implementa de verdad la carpeta `shared/storage/` que `contract-generator` dejó preparada para reutilizar.

## 9. Protecciones del backend (rate limiting y hardening)

- **Rate limiting por IP** (`slowapi`): `create` a 20/min, `status` (el `GET`, que también golpean los bots de previsualización de enlaces) a 30/min, y **`reveal` a 10/min** — el más estricto, porque en la práctica es un endpoint de verificación de contraseña y sin límite se podría fuerza-bruta una contraseña corta. Clave de rate limit: IP real leída de `X-Forwarded-For` (necesario detrás del edge de Vercel, ver `app/core/rate_limit.py`).
- **Límite de tamaño de body** (middleware en `app/main.py`): `Content-Length` mayor a `MAX_BODY_BYTES` corta con `413` antes de llegar a Supabase.
- **Límite de tamaño de archivo** (`MAX_FILE_BYTES`, chequeado en el servicio): da un `422` con mensaje preciso ("el archivo supera el máximo de 10MB") en vez de depender solo del `413` genérico del body.
- **Contraseñas hasheadas con `bcrypt`** — nunca se guarda ni se loguea el valor real.
- **Headers de seguridad** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) en todas las respuestas.
- **CORS** restringido a `localhost:5173` + `FRONTEND_URL`.

## 10. Decisiones de arquitectura (por qué está así)

- **Texto directo en Postgres, archivos en Storage**: evita un viaje a Storage por compartir dos líneas de texto (ver `services/sharedContent/README.md`).
- **La vista única se consume en `/reveal`, nunca en el `GET` de estado**: un bot de previsualización de enlaces (WhatsApp, Slack...) hace un `GET` automático al abrir un link — si eso quemara la vista, el destinatario real se quedaría afuera. Ver `services/sharedContent/security/README.md`.
- **La contraseña se valida antes de consumir la vista**: un intento fallido no debe gastar la única oportunidad de ver el contenido.
- **Atomicidad vía un único `UPDATE ... WHERE viewed_at IS NULL`, no un lock en Python**: es Postgres quien decide, con garantías reales, quién gana cuando dos requests llegan casi al mismo tiempo. Ver `app/shared/storage/supabase_client.py`.
- **`StorageClient` como `Protocol` + inyección con `Depends()`**: permite testear todo el flujo (incluida la condición de carrera de la vista única) con un fake en memoria, sin depender de un proyecto de Supabase real durante `pytest`.
- **Sin worker de limpieza persistente**: la expiración se resuelve on-demand, en el próximo acceso real al link — cumple la regla del portafolio de cero colas/workers 24/7 (con la limitación conocida de que un link nunca vuelto a abrir queda en Supabase indefinidamente; ver `services/sharedContent/cleanup/README.md`).
- **Sin `__init__.py`**: mismo criterio que `contract-generator` — namespace packages implícitos, documentación en el `README.md` de cada carpeta.
