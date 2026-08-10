# S-Rank

*Misiones rango S: acceso restringido, un solo intento, sin margen de error.*

Dos misiones independientes, mismo criterio de fondo: nada queda guardado "por las dudas".

## Qué hace

**Compartir algo sensible** (visualización única): pegás un texto o subís un archivo de hasta 10MB, elegís si protegerlo con contraseña y cuánto va a durar como máximo, y te da un enlace. Quien lo abre ve el contenido una única vez; después, ese enlace deja de funcionar para siempre — expiró, ya se vio, o alguien intentó adivinar la contraseña demasiadas veces, da igual. No se "oculta" — se borra.

**Chat secreto** (salas efímeras): una sala de chat de 2-6 personas, cifrada de punta a punta con una clave que nunca toca ningún servidor. Los mensajes se autodestruyen solos después de unos segundos, imagen y audio tienen las mismas protecciones que el resto, cualquiera puede votar para expulsar a otro participante, y un "Cofre" permite compartir un dato puntual (una contraseña, un código) con un límite real de copias.

Visualmente es minimalista a propósito: nada que distraiga de la única acción que importa en cada pantalla.

## Stack

FastAPI en el backend, con Supabase como base de datos, storage y Realtime (para el chat). Vue 3 en el frontend, sin librerías de más — sin `vue-router`: un puñado de pantallas mutuamente excluyentes, nunca se navega entre ellas del lado del cliente.

## Seguridad

Texto y archivos se encriptan (AES-256-GCM) antes de tocar la base de datos, con una clave que vive solo en el backend — ni Supabase ni nadie más la ve. Aunque alguien accediera a los datos crudos, encontraría bytes sin sentido.

La "vista única" es una garantía real, no una promesa de interfaz: una operación atómica en la base de datos asegura que si dos personas abren el mismo enlace casi al mismo tiempo, solo una llega a ver el contenido.

Los enlaces son prácticamente imposibles de adivinar (identificador aleatorio de 122 bits). Una contraseña equivocada no gasta la única oportunidad de ver el contenido, pero repetirla demasiadas veces autodestruye el enlace.

También se rechazan archivos ejecutables, scripts y documentos de Office con macros — no es un antivirus (no abre ni analiza el contenido real), decisión consciente: escanear de verdad implicaría mandar el archivo a un servicio externo antes de encriptarlo.

El chat secreto usa un modelo distinto: la clave de cifrado se genera en el navegador y viaja solo en el fragmento de la URL (`#clave`), que ningún servidor llega a ver nunca — a diferencia del enlace de visualización única, acá ni siquiera el backend podría descifrar el contenido aunque quisiera. Lo único que el servidor administra ahí es el contador de copias del Cofre y la autorización para entrar a una sala.

Sobre los límites, con honestidad: no hay forma de garantizar al 100% que "solo esta interfaz" puede hablar con la API — cierto para cualquier app pública sin cuentas de usuario. Lo que sí suma protección real: límites de velocidad agresivos, validación del origen de cada request, y un captcha opcional apagado por defecto.

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

Abrí la URL que imprime Vite (por defecto `http://localhost:5173`). Para el enlace de visualización única: compartí un texto o un archivo, copiá el enlace y abrilo en otra pestaña para ver el flujo del lado de quien lo recibe. Para el chat: creá una sala secreta y entrá con el link generado (necesita las tablas/buckets extra de Supabase que documenta `backend/README.md` secciones 12, 14 y 15).

## Tests

- Backend: `cd backend && pytest` — no hace falta Supabase real, usa un doble en memoria para el storage.
- Frontend: `cd frontend && npm run test`

## Algunas decisiones que vale la pena explicar

El texto se guarda directo en la base de datos; solo los archivos reales pasan por el storage, porque no tiene sentido subir dos líneas de texto a un bucket. La vista única se consume recién cuando alguien confirma que quiere ver el contenido, nunca con un simple chequeo de estado — si no fuera así, un bot de previsualización de enlaces (WhatsApp, Slack) quemaría la vista antes de que el destinatario real llegue a abrirlo.

Tampoco hay ningún proceso corriendo en segundo plano limpiando enlaces vencidos: la expiración se resuelve la próxima vez que alguien intenta acceder a ese enlace puntual. Eso significa que un enlace que nadie vuelve a abrir puede quedar guardado (encriptado) indefinidamente — una limitación conocida y aceptada, no un error, a cambio de no tener que mantener un worker corriendo 24/7 para un proyecto de este tamaño.
