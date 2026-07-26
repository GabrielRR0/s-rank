# Frontend — File Sharer (Vue 3 + Vite)

Crea un enlace temporal para compartir texto o un archivo, y la pantalla que ve quien lo abre. Bilingüe (español/inglés) y con tema claro/oscuro, ver `src/i18n/README.md` y `src/style.css`.

## 1. Requisitos

- Node.js 20+ (`node --version` para verificar).
- El backend corriendo (ver `../backend/README.md`) — este frontend no genera ni guarda nada por sí solo.

## 2. Cómo ejecutarlo paso a paso

Todos los comandos se corren **desde la carpeta `frontend/`**.

### 2.1 Instalar las dependencias

```
npm install
```

### 2.2 Levantar el servidor de desarrollo

```
npm run dev
```

Imprime una URL, normalmente `http://localhost:5173`. Las llamadas a `/api/shared-content/...` se redirigen automáticamente al backend en `http://localhost:8000` vía el proxy configurado en `vite.config.ts`.

### 2.3 Build de producción

```
npm run build
```

Corre el chequeo de tipos (`vue-tsc -b`) y genera los archivos estáticos en `dist/`.

## 3. Cómo correr los tests

```
npm run test
```

Corre Vitest una sola vez sobre los archivos `*.spec.ts` co-ubicados junto al código que prueban.

## 4. Variables de entorno

Copiar `.env.example` a `.env` solo si el backend **no** está en `localhost:8000`:

- `VITE_API_BASE_URL`: URL base del backend. Sin definirla, las llamadas usan rutas relativas, que funcionan en dev gracias al proxy. **En producción es obligatoria** si el frontend y el backend quedan en dominios distintos.

## 5. Estructura del proyecto

```
src/
  App.vue                       # decide entre crear un share ("/") o verlo ("/s/:id")
  main.ts
  style.css                     # variables de diseño -> ver ../DESIGN.md (raíz del portafolio)
  components/
    fileSharing/                # -> ver README.md de la carpeta
    ui/                         # -> ver README.md de la carpeta
  composables/fileSharing/      # -> ver README.md de la carpeta
  services/fileSharing/         # -> ver README.md de la carpeta
  utils/validators/             # -> ver README.md de la carpeta
  i18n/                         # -> ver README.md de la carpeta
```

## 6. Decisiones de arquitectura (por qué está así)

- **Sin `vue-router`**: la app tiene exactamente dos pantallas (crear un share, verlo) y nunca se navega entre ellas del lado del cliente — se llega a una o a la otra según cómo se abrió la página. `App.vue` decide con una expresión regular sobre `window.location.pathname`; una librería de ruteo completa sería sobredimensionada, mismo criterio que llevó a `contract-generator` a evitar `axios`/`vue-i18n`.
- **`fetch` nativo, no `axios`**: mismo motivo que `contract-generator` — pocas llamadas HTTP simples.
- **El botón "Ver contenido" siempre requiere un click explícito**, incluso sin contraseña: evita que la vista única se consuma por un simple acceso a la página. Ver `composables/fileSharing/README.md`.
- **Imágenes se muestran inline, el resto de los archivos se descargan**: el backend preserva el `Content-Type` original; el frontend decide la UI según `blob.type`. Ver `components/fileSharing/README.md`.
- **`prefers-reduced-motion` sí se respeta** (a diferencia de `contract-generator`, que lo desactivó por pedido puntual del usuario en ese proyecto): se sigue la regla tal como está en `../DESIGN.md`.
- **Acento violeta**, distinto del azul de `contract-generator`, para diferenciar visualmente este proyecto dentro del portafolio (`DESIGN.md` #1.5).
- **`VITE_API_BASE_URL` opcional en dev**: mismo motivo que `contract-generator` — cero configuración para levantar el proyecto localmente.
