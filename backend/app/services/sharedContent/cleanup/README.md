# services/sharedContent/cleanup

Borrado fisico del recurso compartido - nunca un soft delete (`viewed_at` marca "ya se vio", pero lo que deja el link realmente inservible es que el archivo y la fila dejan de existir).

## Archivos

- **`expire_on_access.py`**: `is_expired(share)` (compara `expires_at` contra la hora actual), `purge_share(share, client)` (borra el archivo de Storage si corresponde + la fila de Postgres) y `raise_if_expired(share, client)` (compone las dos anteriores: si expiro, purga y lanza `ShareUnavailableError`).

## Por que "invocada on-demand, no worker persistente" (tal cual lo pide el README raiz del portafolio)

No hay ningun cron ni proceso en segundo plano recorriendo la tabla `shared_content` buscando filas vencidas - eso violaria la regla de "cero colas/workers 24/7" del portafolio (necesaria para que el demo funcione gratis en un hosting serverless). En cambio, la expiracion se resuelve perezosamente: `shared_content_service.get_share_status` y `reveal_share` llaman a `raise_if_expired` en cada acceso real a un share puntual, y recien ahi (si corresponde) se dispara el borrado.

**Limitacion conocida y aceptada**: un share que expira y cuyo link nadie vuelve a abrir nunca mas queda en Supabase indefinidamente (nadie dispara el chequeo que lo purgaria). Para el alcance de este portafolio no se resuelve (agregar un cron implicaria exactamente el tipo de proceso persistente que la regla busca evitar); si el volumen real lo justificara, la mejora natural seria una funcion programada de Supabase (`pg_cron`, gestionada por Supabase mismo, no un worker propio corriendo 24/7).

## Por que `purge_share` tambien se usa despues de una vista exitosa (no solo cuando algo expira)

Es la misma operacion ("borrar fisicamente este recurso") sin importar el motivo. `shared_content_service.reveal_share` la reutiliza justo despues de leer el contenido para devolverlo, en vez de duplicar la logica de borrado en dos lugares.
