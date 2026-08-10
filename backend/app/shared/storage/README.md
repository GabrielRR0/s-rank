# shared/storage

Cliente de acceso a Supabase (Postgres + Storage). Vive en `shared/` (no en `services/sharedContent/`) porque, igual que documenta el mismo README de `contract-generator`, no es especifico de este dominio - los demas proyectos del portafolio que necesiten persistencia tambien podrian reutilizarlo.

## Archivos

- **`supabase_client.py`**: define `StorageClient` (un `Protocol` con las 7 operaciones minimas que el dominio necesita: insertar/leer/marcar-visto/borrar la fila de metadata, y subir/bajar/borrar el archivo en Storage), `SupabaseStorageClient` (la implementacion real, sobre `supabase-py`) y `get_storage_client()` (fabrica cacheada que construye el cliente real perezosamente).
- **`supabase_vault_client.py`**: mismo patron (`Protocol` + implementacion + fabrica cacheada), pero para el dominio `secretVault` (ver `app/services/secretVault/README.md` y `backend/README.md` seccion 12). Deliberadamente **no** comparte `StorageClient`/`SupabaseStorageClient` con el archivo de arriba: las operaciones no tienen nada en comun (un contador atomico de copias vs. una marca de vista unica), asi que una interfaz compartida solo agregaria acoplamiento sin beneficio real. Su unica operacion no trivial, `decrement_copies_if_available`, llama a una funcion SQL via `.rpc()` en vez de `.update()` - ver el "por que" en `backend/README.md` seccion 12. Tambien gana `upload_file`/`download_file`/`delete_file` (Storage) para los items de imagen/audio del Cofre - un item de texto nunca los toca.
- **`supabase_chat_rooms_client.py`**: mismo patron otra vez, para `secretChatAuth` (ver `backend/README.md` seccion 13) - una fila por sala con contraseña (`id`, `password_hash`, `expires_at`). Tampoco comparte cliente con los de arriba.
- **`supabase_chat_media_client.py`**: mismo patron otra vez, para `secretChatMedia` (ver `backend/README.md` seccion 15) - imagenes/audio del chat enviados como mensaje normal (no el Cofre). Combina tabla + Storage como `supabase_client.py` (necesita ambos), pero es su propio `Protocol` porque el contrato es distinto: sin marca de "visto unico" ni contraseña, con TTL como unico mecanismo de expiracion.

## Por que esta implementacion existe (a diferencia de `contract-generator`)

En `contract-generator`, esta misma carpeta quedo vacia a proposito: el generador de PDF no necesita persistir nada entre requests. Este proyecto si depende de Supabase desde el dia uno, porque en un hosting serverless (Vercel) el filesystem no persiste entre invocaciones: el archivo subido en el `POST /api/shared-content` de un usuario y descargado despues en el `POST /api/shared-content/{id}/reveal` de otro pueden ejecutarse en instancias completamente distintas del backend - sin un storage externo compartido, el segundo request nunca encontraria el archivo del primero.

## Por que `StorageClient` es un `Protocol` en vez de solo usar `SupabaseStorageClient` directo

Para poder testear el flujo completo (crear, consultar estado, revelar, expirar) sin necesitar un proyecto de Supabase real corriendo durante `pytest`. El router pide el cliente via `Depends(get_storage_client)`; en los tests, `app.dependency_overrides[get_storage_client]` lo reemplaza por un `FakeStorageClient` en memoria (ver `tests/conftest.py`), y los tests de servicio le pasan ese mismo fake directo como argumento. `SupabaseStorageClient` nunca se instancia durante los tests.

## Por que `get_storage_client()` es perezosa (`@lru_cache`, no una instancia a nivel de modulo)

Si `SupabaseStorageClient(...)` se construyera al importar este archivo, cualquier `import app.main` (incluido el de los tests) fallaria en una maquina donde todavia no se configuro `SUPABASE_URL`/`SUPABASE_KEY` en `.env`. Con `@lru_cache`, la construccion real recien ocurre la primera vez que algo llama a `get_storage_client()` - y en tests, esa funcion nunca se llega a invocar porque el override la reemplaza antes.
