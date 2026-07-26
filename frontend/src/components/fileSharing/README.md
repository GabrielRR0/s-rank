# components/fileSharing

Componentes del dominio "compartir archivos" - dos flujos independientes: crear un share (quien comparte) y verlo (quien recibe el link).

## Archivos

- **`FileSharingMain.vue`**: orquestador del flujo de creación. Usa `useUpload` para todo el estado y renderiza el formulario (tabs texto/archivo, contraseña opcional, expiración) o, una vez creado el share, `ShareResult`.
- **`UploadZone.vue`**: zona de drag & drop + selector de archivo por click. Solo se usa en modo "archivo" - el modo "texto" es un simple `<textarea>` inline en `FileSharingMain.vue` (no amerita su propio componente).
- **`PasswordToggle.vue`**: switch que muestra/oculta un campo de contraseña. Dos `v-model` (`activo`, `password`).
- **`ExpirationSelector.vue`**: grupo de botones con las duraciones permitidas (mismas que `ALLOWED_EXPIRATIONS_MINUTES` del backend).
- **`ShareResult.vue`**: enlace generado + botón de copiar + opción de compartir algo más.
- **`TurnstileWidget.vue`**: captcha invisible de Cloudflare, montado condicionalmente en `FileSharingMain.vue` solo si `TURNSTILE_ENABLED` está activo (ver `composables/fileSharing/useTurnstile.ts`). Apagado por defecto - con el flag apagado este componente ni se renderiza.
- **`ViewContent.vue`**: pantalla de quien abre el link (`/s/:id`, montada desde `App.vue`). Cubre todos los estados de `useOneTimeView` - cargando, no disponible, pide contraseña, lista para ver, y el contenido ya revelado (texto con `<pre>`, imagen inline, o botón de descarga para cualquier otro archivo).

## Por qué `ViewContent.vue` siempre exige un click en "Ver contenido", incluso sin contraseña

Aunque el share no tenga contraseña, la pantalla no llama a `revelar()` automáticamente al cargar - siempre espera una acción explícita del usuario. Ver `composables/fileSharing/README.md` para el motivo completo: es la misma cautela que ya aplica el backend (la vista única nunca se consume por un simple acceso al link).

## Por qué las imágenes se muestran inline y el resto de los archivos se descargan

El backend preserva el `Content-Type` original del archivo subido y, para imágenes, responde con `Content-Disposition: inline` (ver `backend/app/routers/sharedContent/README.md`) - `ViewContent.vue` arma un `URL.createObjectURL` del blob recibido y decide entre `<img>` o un botón de descarga mirando si `blob.type` empieza con `image/`. Es una mejor experiencia para el caso de uso más común de este proyecto (compartir una foto) que forzar siempre una descarga.
