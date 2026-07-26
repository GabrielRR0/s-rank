# utils/validators

Funciones puras (sin dependencia de Vue) para validar la entrada del formulario de creación, antes de pegarle al backend.

## Archivos

- **`validateShareInput.ts`**: `validateTextInput` (no vacío) y `validateFileInput` (presente y dentro de `MAX_FILE_BYTES`, el mismo límite de 10MB que aplica el backend). Ambas devuelven un array de mensajes de error (vacío si es válido), mismo patrón que `validateContractFields.ts` en `contract-generator`.

## Por qué esta validación no reemplaza la del backend

Es solo para feedback inmediato en la UI (evitar un viaje de red para un error obvio, como un campo vacío). El backend vuelve a validar todo de forma independiente (`shared_content_service.create_share`) porque nunca hay que confiar en datos que vienen del cliente.
