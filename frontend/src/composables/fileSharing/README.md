# composables/fileSharing

Todo el estado y la lógica del dominio "compartir archivos" vive acá, no en los componentes `.vue` - permite testear la lógica de negocio sin montar nada (mismo criterio que `useContractWizard` en `contract-generator`).

## Archivos

- **`useUpload.ts`**: estado del flujo de creación (modo texto/archivo, contraseña opcional, expiración elegida - hasta 24hs máximo -, token de Turnstile si aplica, validación, llamada al servicio, manejo de error). Usado por `FileSharingMain.vue`.
- **`useOneTimeView.ts`**: estado del flujo de revelado del lado del destinatario (`EstadoVisor`: `cargando` → `pide-password` | `listo-para-ver` → `revelando` → `revelado`, o `no-disponible` en cualquier punto). Usado por `ViewContent.vue`.
- **`useTurnstile.ts`**: `TURNSTILE_ENABLED` (constante, `import.meta.env.VITE_TURNSTILE_ENABLED === 'true'`) + `useTurnstile()` (carga el script de Cloudflare on-demand y expone el token vía callback). Usado por `TurnstileWidget.vue`, apagado por defecto.

## Por qué `useOneTimeView` separa `cargarEstado` (al montar) de `revelar` (acción explícita del usuario)

Refleja la misma separación que ya existe en el backend (ver `backend/app/services/sharedContent/security/README.md`): consultar el estado del link es seguro y no tiene efectos secundarios, así que se dispara solo al entrar a la pantalla. Revelar el contenido sí consume la vista única, así que **nunca** se dispara automáticamente - siempre requiere un click explícito de "Ver contenido", incluso cuando el share no tiene contraseña. Esto evita que la vista única se queme por un simple `onMounted` (por ejemplo, si un bot de previsualización de enlaces llegara a ejecutar JavaScript, cosa que hoy no hacen, pero es la misma cautela que ya se aplicó del lado del backend).
