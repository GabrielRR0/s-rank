# shared/storage

Cliente de acceso a Supabase (Postgres + Storage). Vive en `shared/` (no en `services/sharedContent/`) porque, igual que documenta el mismo README de `contract-generator`, no es especifico de este dominio - los demas proyectos del portafolio que necesiten persistencia tambien podrian reutilizarlo.

## Archivos

- **`supabase_client.py`**: define `StorageClient` (un `Protocol` con las 7 operaciones minimas que el dominio necesita: insertar/leer/marcar-visto/borrar la fila de metadata, y subir/bajar/borrar el archivo en Storage), `SupabaseStorageClient` (la implementacion real, sobre `supabase-py`) y `get_storage_client()` (fabrica cacheada que construye el cliente real perezosamente).

## Por que esta implementacion existe (a diferencia de `contract-generator`)

En `contract-generator`, esta misma carpeta quedo vacia a proposito: el generador de PDF no necesita persistir nada entre requests. Este proyecto si depende de Supabase desde el dia uno, porque en un hosting serverless (Vercel) el filesystem no persiste entre invocaciones: el archivo subido en el `POST /api/shared-content` de un usuario y descargado despues en el `POST /api/shared-content/{id}/reveal` de otro pueden ejecutarse en instancias completamente distintas del backend - sin un storage externo compartido, el segundo request nunca encontraria el archivo del primero.

## Por que `StorageClient` es un `Protocol` en vez de solo usar `SupabaseStorageClient` directo

Para poder testear el flujo completo (crear, consultar estado, revelar, expirar) sin necesitar un proyecto de Supabase real corriendo durante `pytest`. El router pide el cliente via `Depends(get_storage_client)`; en los tests, `app.dependency_overrides[get_storage_client]` lo reemplaza por un `FakeStorageClient` en memoria (ver `tests/conftest.py`), y los tests de servicio le pasan ese mismo fake directo como argumento. `SupabaseStorageClient` nunca se instancia durante los tests.

## Por que `get_storage_client()` es perezosa (`@lru_cache`, no una instancia a nivel de modulo)

Si `SupabaseStorageClient(...)` se construyera al importar este archivo, cualquier `import app.main` (incluido el de los tests) fallaria en una maquina donde todavia no se configuro `SUPABASE_URL`/`SUPABASE_KEY` en `.env`. Con `@lru_cache`, la construccion real recien ocurre la primera vez que algo llama a `get_storage_client()` - y en tests, esa funcion nunca se llega a invocar porque el override la reemplaza antes.
