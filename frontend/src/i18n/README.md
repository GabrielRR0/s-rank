# i18n

Idioma de la interfaz (español/inglés) - mismo patrón que `contract-generator`: un diccionario plano + un composable con estado singleton, sin `vue-i18n`.

## Archivos

- **`translations.ts`**: `translations.es` / `translations.en`, un `Record<string, string>` plano por idioma.
- **`useLocale.ts`**: `locale` (ref singleton a nivel de módulo, persistido en `localStorage`, detectado de `navigator.language` en la primera visita) y `t` (computed con el diccionario del idioma activo).

## Por qué no hay traducción del contenido compartido (a diferencia del contrato en `contract-generator`)

En `contract-generator` hay dos sistemas de i18n separados porque el *contenido generado* (el contrato) también tiene texto propio que traducir. Acá el contenido compartido es literalmente lo que el usuario escribió o el archivo que subió - no hay nada que el backend deba traducir. Por eso `sharing.service.ts` no tiene ningún parámetro `locale`: la única traducción de todo el proyecto es la de la interfaz, resuelta enteramente acá.
