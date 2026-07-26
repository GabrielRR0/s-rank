# S-Rank

*Misiones rango S: acceso restringido, un solo intento, sin margen de error.*

Compartir algo sensible: un enlace que se puede abrir una sola vez (o que expira solo, en máximo 24 horas) y que después desaparece de verdad. No se "oculta" — se borra.

## Qué hace

Pegás un texto o subís un archivo de hasta 10MB, elegís si querés protegerlo con una contraseña y cuánto tiempo va a estar disponible como máximo, y te da un enlace. La persona que lo abre ve el contenido una única vez; después de eso, ese enlace deja de funcionar para siempre, sin importar si expiró, si ya se vio, o si alguien intentó adivinar la contraseña demasiadas veces.

Visualmente es minimalista a propósito: nada que distraiga de la única acción que importa en cada pantalla.

## Stack

FastAPI en el backend, con Supabase como base de datos y storage. Vue 3 en el frontend, sin librerías de más — la app tiene literalmente dos pantallas (crear un enlace, verlo), así que ni siquiera hace falta un router.

## Seguridad

Tanto el texto como los archivos se encriptan antes de tocar la base de datos (AES-256-GCM), con una clave que vive solo en el backend — ni Supabase ni nadie más la ve. No hay ninguna excepción: un texto pegado y un archivo subido pasan por el mismo cifrado antes de guardarse, solo cambia dónde queda cada uno (el texto ya cifrado en una columna de Postgres, el archivo ya cifrado en Supabase Storage). Aunque alguien accediera a los datos crudos de la base, se encontraría con bytes sin sentido en cualquiera de los dos casos.

La "vista única" es una garantía real, no una promesa de la interfaz: está resuelta con una sola operación atómica en la base de datos, así que si dos personas abren el mismo enlace casi al mismo tiempo, solo una de las dos puede llegar a ver el contenido.

Los enlaces son prácticamente imposibles de adivinar — cada uno usa un identificador aleatorio de 122 bits, así que ni con mil millones de intentos por segundo alguien encontraría uno válido probando al azar. Una contraseña equivocada no gasta la única oportunidad de ver el contenido, pero repetirla demasiadas veces sí autodestruye el enlace, sin importar desde cuántas direcciones distintas se intente.

También se rechazan archivos ejecutables, scripts y documentos de Office con macros antes de aceptarlos. No es un antivirus — no abre ni analiza el contenido real del archivo — y esa es una decisión consciente: escanear de verdad implicaría mandar el archivo a un servicio externo antes de encriptarlo, justo lo que este proyecto intenta evitar.

Y para ser honesto sobre los límites: no hay forma de garantizar al 100% que "solo esta interfaz" puede hablar con la API — eso es así para cualquier aplicación pública sin cuentas de usuario, no un descuido de este proyecto en particular. Lo que sí tiene sentido, y está hecho, es sumar las capas que dan protección real: límites de velocidad agresivos, validación del origen de cada request, y un captcha opcional que queda apagado por defecto, para cuando haga falta más fricción contra bots.

## Probarlo en local

**Backend** (necesita un proyecto gratuito de Supabase, ver `backend/README.md`):
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# copiar .env.example a .env y completar las variables de Supabase
uvicorn app.main:app --reload --port 8000
```

**Frontend** (en otra terminal):
```
cd frontend
npm install
npm run dev
```

Abrir la URL que imprime Vite (por defecto `http://localhost:5173`), compartir un texto o un archivo, copiá el enlace y abrilo en otra pestaña para ver el flujo completo del lado de quien lo recibe.

## Tests

- Backend: `cd backend && pytest` — no hace falta Supabase real, usa un doble en memoria para el storage.
- Frontend: `cd frontend && npm run test`

## Algunas decisiones que vale la pena explicar

El texto se guarda directo en la base de datos; solo los archivos reales pasan por el storage, porque no tiene sentido subir dos líneas de texto a un bucket. La vista única se consume recién cuando alguien confirma que quiere ver el contenido, nunca con un simple chequeo de estado — si no fuera así, un bot de previsualización de enlaces (WhatsApp, Slack) quemaría la vista antes de que el destinatario real llegue a abrirlo.

Tampoco hay ningún proceso corriendo en segundo plano limpiando enlaces vencidos: la expiración se resuelve la próxima vez que alguien intenta acceder a ese enlace puntual. Eso significa que un enlace que nadie vuelve a abrir puede quedar guardado (encriptado) indefinidamente — una limitación conocida y aceptada, no un error, a cambio de no tener que mantener un worker corriendo 24/7 para un proyecto de este tamaño.
