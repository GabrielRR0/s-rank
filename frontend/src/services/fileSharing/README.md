# services/fileSharing

Único lugar del frontend que llama a `fetch` (mismo criterio que `contract-generator`). Envuelve los 3 endpoints del backend y les da nombres/tipos TypeScript propios, para que el resto del frontend no conozca la forma exacta del JSON que viaja por HTTP.

## Archivos

- **`sharing.service.ts`**: `createTextShare` / `createFileShare` (arman el `FormData` y llaman a `POST /api/shared-content`), `fetchShareStatus` (`GET /api/shared-content/{id}`), `revealShare` (`POST /api/shared-content/{id}/reveal` - distingue si la respuesta es JSON de texto o un binario de archivo por el `Content-Type` real de la respuesta). También define `ShareRevealError`, una subclase de `Error` con el status HTTP incluido.

## Por qué `ShareRevealError` en vez de un `Error` genérico

`useOneTimeView` necesita reaccionar distinto según el motivo del fallo de `revealShare`: un `401` (contraseña incorrecta) deja al usuario reintentar en el mismo formulario, mientras que un `410` (vencido o ya visto) muestra la pantalla final de "este enlace ya no está disponible". Sin el `status` adjunto al error, el composable no tendría forma de diferenciar ambos casos más que parseando el mensaje de texto.

## Por qué `createTextShare`/`createFileShare` arman `FormData` en vez de mandar JSON

El backend expone un único endpoint `multipart/form-data` para ambos casos (ver `backend/app/schemas/sharedContent/README.md`) - un archivo no puede viajar dentro de un body JSON sin codificarlo a base64 primero, y hacerlo solo para el caso de texto hubiera significado dos formatos de body distintos para el mismo endpoint.
