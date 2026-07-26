# services/sharedContent

Orquestador del dominio "contenido compartido": crear un share, consultar su estado sin consumirlo, y revelarlo (consumiendo la vista unica).

## Archivos

- **`shared_content_service.py`**: `create_share` (guarda texto directo en Postgres o sube el archivo a Storage segun `content_type`, valida tamaño/expiracion, hashea la contraseña si se dio una), `get_share_status` (lectura seguro para `GET /{id}` - nunca revela contenido ni consume la vista), `reveal_share` (valida contraseña, consume la vista unica via `security/one_time_access.py`, purga el recurso via `cleanup/expire_on_access.py` y recien ahi devuelve el contenido).
- **`security/`**: hash de contraseñas y la garantia atomica de "vista unica" -> ver su propio README.
- **`cleanup/`**: borrado fisico del recurso (por expiracion o post-vista) -> ver su propio README.

## Por que texto y archivo se guardan distinto

El texto plano pegado por el usuario se guarda directo en la columna `content_text` de la tabla `shared_content`; solo cuando `content_type == "file"` el contenido pasa por Supabase Storage (`storage_path` apunta a `{share_id}/{nombre_original}`). Subir a Storage tiene sentido para archivos (potencialmente varios MB, binarios), pero seria un viaje de red innecesario para compartir dos lineas de texto que ya caben comodas en una fila de Postgres.

## Por que `reveal_share` hace `get_share` (lectura simple) y despues `consume_view` (atomico) en vez de todo en un solo paso

La contraseña tiene que validarse contra el contenido ANTES de decidir si se consume la vista (ver `security/README.md`) - por eso primero se lee la fila sin tocar nada, se valida contraseña/expiracion, y solo si todo esta bien se ejecuta la operacion atomica que efectivamente la quema. La atomicidad real (que dos accesos casi simultaneos no revelen el contenido dos veces) la da exclusivamente `consume_view`/`mark_viewed_if_unseen`, no el orden de los pasos en Python.
