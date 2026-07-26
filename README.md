# File Sharer

## Problema que resuelve

Compartir un archivo, texto o imagen de forma segura y efímera, sin depender de servicios externos ni dejar rastro permanente. El contenido se ve **una sola vez** (o expira por tiempo, lo que ocurra primero) y se borra físicamente del storage justo después, nunca queda "oculto" en algún lado.

## Estado actual

Camino feliz completo: compartir texto o un archivo (hasta 10MB) con contraseña opcional y expiración configurable, generar el enlace, y consumirlo del lado del destinatario — incluyendo el caso de contraseña incorrecta (no quema la vista) y el de dos accesos casi simultáneos al mismo enlace (solo uno gana).

## Stack

- Backend: FastAPI + [Supabase](https://supabase.com) (Postgres para metadata, Storage para los archivos) + `bcrypt` para las contraseñas.
- Frontend: Vue 3 (Composition API + `<script setup>`) + Vite + TypeScript.

## Diseño visual

El estilo de todas las pantallas de este proyecto (y del resto del portafolio) sigue [`../DESIGN.md`](../DESIGN.md). Este proyecto usa violeta como color de acento (distinto del azul de `contract-generator`) para diferenciarse dentro del portafolio, tal como pide esa guía.

## Cómo probarlo

**Backend** (requiere un proyecto de Supabase configurado, ver `backend/README.md` sección 3.4):
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# copiar .env.example a .env y completar SUPABASE_URL/SUPABASE_KEY
uvicorn app.main:app --reload --port 8000
```

**Frontend** (en otra terminal):
```
cd frontend
npm install
npm run dev
```

Abrir la URL que imprime Vite (por defecto `http://localhost:5173`), compartir un texto o un archivo, copiar el enlace generado y abrirlo en otra pestaña (o en modo incógnito) para ver el flujo completo del lado del destinatario.

## Cómo correr los tests

- Backend: `cd backend && pytest` (no necesita Supabase real - usa un fake de storage en memoria, ver `backend/app/shared/storage/README.md`).
- Frontend: `cd frontend && npm run test`

## Decisiones de arquitectura

- **Texto directo en Postgres, archivos en Supabase Storage**: evita un viaje a Storage por compartir dos líneas de texto (ver `backend/app/services/sharedContent/README.md`).
- **La vista única se consume recién en `POST /reveal`, nunca en el `GET` de estado**: un bot de previsualización de enlaces (WhatsApp, Slack...) hace un `GET` automático al abrir un link - si eso quemara la vista, el destinatario real se quedaría afuera. Ver `backend/app/services/sharedContent/security/README.md`.
- **La contraseña se valida antes de consumir la vista**: un intento fallido no gasta la única oportunidad de ver el contenido; solo un `410` (vencido/ya visto) es realmente terminal, un `401` (contraseña incorrecta) deja reintentar.
- **Atomicidad real vía un único `UPDATE ... WHERE viewed_at IS NULL` en Postgres**, no un lock en la aplicación - es la base de datos quien decide, con garantías reales, quién gana cuando dos requests llegan casi al mismo tiempo (ver `backend/app/shared/storage/supabase_client.py`).
- **`StorageClient` como `Protocol` + inyección de dependencias en FastAPI**: permite testear todo el flujo (incluida la condición de carrera de la vista única) con un fake en memoria, sin necesitar un proyecto de Supabase real para correr `pytest`.
- **Sin frontend router**: la app tiene exactamente dos pantallas (crear un share, verlo) y nunca se navega entre ellas del lado del cliente - una librería de ruteo completa sería sobredimensionada.
- **Sin worker de limpieza persistente**: la expiración se resuelve on-demand, en el próximo acceso real al link - cumple la regla del portafolio de cero colas/workers 24/7, con la limitación conocida de que un link nunca vuelto a abrir queda en Supabase indefinidamente (ver `backend/app/services/sharedContent/cleanup/README.md`).
- **Mismas convenciones estructurales que `contract-generator`**: sin `__init__.py` en el backend, tipo→dominio en ambas capas, un `README.md` por carpeta con lógica real, y el mismo patrón de deploy (`vercel.json` con dos servicios).
