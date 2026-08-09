# components/fileSharing

Componentes del dominio "compartir archivos" - dos flujos independientes: crear un share (quien comparte) y verlo (quien recibe el link).

## Archivos

- **`FileSharingMain.vue`**: orquestador del flujo de creación. Usa `useUpload` para todo el estado y renderiza el formulario (tabs texto/archivo, contraseña opcional, expiración) o, una vez creado el share, `ShareResult`.
- **`UploadZone.vue`**: zona de drag & drop + selector de archivo por click. Solo se usa en modo "archivo" - el modo "texto" es un simple `<textarea>` inline en `FileSharingMain.vue` (no amerita su propio componente).
- **`ExpirationSelector.vue`**: grupo de botones con las duraciones permitidas (mismas que `ALLOWED_EXPIRATIONS_MINUTES` del backend).
- **`ShareResult.vue`**: enlace generado + botón de copiar + opción de compartir algo más.
- **`ViewContent.vue`**: pantalla de quien abre el link (`/s/:id`, montada desde `App.vue`). Cubre todos los estados de `useOneTimeView` - cargando, no disponible, pide contraseña, lista para ver, y el contenido ya revelado (texto con `<pre>`, imagen inline, o botón de descarga para cualquier otro archivo).

`PasswordToggle.vue` y `TurnstileWidget.vue` se mudaron a `components/ui/` (dejaron de ser específicos de este dominio en cuanto `secretChat` necesitó lo mismo) - `useTurnstile.ts` correspondiente vive ahora en `composables/useTurnstile.ts`, sin carpeta de dominio. Mismo criterio para `AudioPlayer.vue`/`useAudioPlayer.ts` (ver la sección de audio más abajo).

## Por qué `ViewContent.vue` siempre exige un click en "Ver contenido", incluso sin contraseña

Aunque el share no tenga contraseña, la pantalla no llama a `revelar()` automáticamente al cargar - siempre espera una acción explícita del usuario. Ver `composables/fileSharing/README.md` para el motivo completo: es la misma cautela que ya aplica el backend (la vista única nunca se consume por un simple acceso al link).

## Por qué las imágenes y el audio se muestran inline y el resto de los archivos se descargan

El backend preserva el `Content-Type` original del archivo subido y, para imágenes, responde con `Content-Disposition: inline` (ver `backend/app/routers/sharedContent/README.md`) - `ViewContent.vue` decide entre `<img>`, un reproductor de audio o un botón de descarga mirando si `blob.type` empieza con `image/`/`audio/`. Es una mejor experiencia para los casos de uso más comunes de este proyecto (compartir una foto o un audio) que forzar siempre una descarga.

La imagen (`<img class="imagen-revelada">`) bloquea el menú contextual y el arrastre, y el audio usa el mismo reproductor propio que el chat secreto (`AudioPlayer.vue`/`useAudioPlayer.ts`, sobre la Web Audio API - sin `<audio src>` nativo ni botón de descarga) - ver `secretChat/README.md`, sección "Descarga de imagen/audio: fricción, no una garantía criptográfica", para la explicación completa de qué protege esto y qué no. El resto de los tipos de archivo (PDF, zip, documentos, etc.) siguen descargándose directo - no hay forma sensata de mostrarlos inline ni de "reproducirlos", así que no aplica.
