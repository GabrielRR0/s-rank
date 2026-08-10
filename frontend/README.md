# Frontend — S-Rank (Vue 3 + Vite)

Dos misiones independientes. **Compartir texto/archivo** (`components/fileSharing/`): genera un enlace de visualización única (se abre una sola vez y desaparece) y la pantalla que ve quien lo abre — ver `components/fileSharing/README.md`. **Chat secreto** (`components/secretChat/`): salas efímeras de 2-6 personas cifradas de punta a punta (la clave nunca toca el backend), con mensajes que se autodestruyen solos, imagen/audio con las mismas protecciones, expulsión por voto, y un "Cofre" para compartir un dato con un límite de copias — ver `components/secretChat/README.md`. Bilingüe (español/inglés) y con tema claro/oscuro — ver `src/i18n/README.md` y `src/style.css`.

## 1. Cómo ejecutarlo

Requisitos: Node.js 20+, y el backend corriendo (ver `../backend/README.md`) — este frontend no genera ni guarda nada por sí solo. Todo desde la carpeta `frontend/`:

```
npm install
npm run dev
```
Imprime una URL (normalmente `http://localhost:5173`); las llamadas a `/api/...` se redirigen al backend en `http://localhost:8000` vía el proxy de `vite.config.ts`.

```
npm run build
```
Corre el chequeo de tipos (`vue-tsc -b`) y genera `dist/`.

## 2. Tests

```
npm run test
```
Vitest una sola vez sobre los `*.spec.ts` co-ubicados junto al código que prueban.

## 3. Variables de entorno

Copiar `.env.example` a `.env` solo si hace falta:

- `VITE_API_BASE_URL`: URL del backend. Sin definirla, rutas relativas (funcionan en dev por el proxy) — **obligatoria en producción** si frontend/backend quedan en dominios distintos.
- `VITE_TURNSTILE_ENABLED` / `VITE_TURNSTILE_SITE_KEY`: captcha de Cloudflare, apagado por defecto.

## 4. Estructura

```
src/
  App.vue                  # crear un share ("/"), verlo ("/s/:id"), o el chat ("/chat/:id")
  style.css                 # variables de diseño -> ../DESIGN.md (raíz del portafolio)
  components/ composables/ services/    # una carpeta por dominio (fileSharing, secretChat) + ui/ compartido - cada una con su README.md
  utils/validators/ i18n/
```

## 5. Decisiones de arquitectura

- **Sin `vue-router`**: pantallas mutuamente excluyentes, nunca se navega entre ellas del lado del cliente — `App.vue` decide con una regex sobre `window.location.pathname`. Una librería de ruteo completa sería sobredimensionada.
- **`fetch` nativo, no `axios`**: pocas llamadas HTTP simples.
- **"Ver contenido" siempre requiere un click explícito**, incluso sin contraseña — evita que la vista única se consuma por un simple acceso a la página.
- **Imágenes y audio se muestran inline, el resto se descarga**: el backend preserva el `Content-Type`; el frontend decide según `blob.type`.
- **Acento violeta**, para diferenciar este proyecto dentro del portafolio.
- **Expiración tope de 24hs**: contenido delicado, se espera que se vea casi de inmediato.
- **Turnstile apagado por defecto**: `TurnstileWidget.vue` ni se monta ni carga el script de Cloudflare sin `VITE_TURNSTILE_ENABLED=true`.
- **`<meta name="referrer" content="no-referrer">`**: el id del share vive en la URL (`/s/:id`) — sin esto, el navegador podría filtrarla como `Referer` al navegar a un link externo.
