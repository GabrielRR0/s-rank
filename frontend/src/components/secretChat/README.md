# components/secretChat

Segunda misión de S-Rank: salas de chat efímero (2-6 personas) con autodestrucción de mensajes y un "Cofre" para datos sensibles con límite de copias. Reutiliza los primitivos de `components/ui/` y el sistema de diseño existente — sin CSS framework, sin colores nuevos fuera del acento del proyecto.

## Por qué (casi) no hay tabla de "salas"

Los mensajes viajan por Supabase Realtime **Broadcast** (pub/sub puro, nunca tocan Postgres — `backend/README.md` sección 12), así que el servidor no tiene registro de la conversación ("Zero-Log"): quien se une a mitad de charla no ve mensajes previos, y un refresh pierde el historial de esa pestaña. Dos cosas sí pasan por el backend: el **Cofre** (límite de copias, necesita garantía atómica entre varios participantes) y, solo si se activa, una **contraseña de sala** (`secret_chat_rooms`, sección 14) verificada server-side.

La clave de cifrado va en el fragmento de la URL (`/chat/:roomId#clave`) — nunca viaja en ningún request HTTP, así que ni el backend ni Supabase la ven. Capacidad y TTL sí van en el query string (`?cap=&ttl=`): no son secretos.

Desde que existe `secretChatAuth` (sección 14), la anon key sola ya no alcanza para abrir un canal — hace falta un token de corta duración, emitido detrás de `verify_origin` + Turnstile, que cierra el hueco de clonar el frontend a otro dominio.

## Flujo de componentes

```
App.vue
  ├── CreateChatMain.vue          (toggle "Chat secreto" en el home; password + Turnstile opcionales)
  │     └── ChatCreateResult.vue  (enlace generado + "entrar ahora")
  └── ChatRoomMain.vue            (ruta /chat/:roomId#clave; primer gate: fueExpulsado(roomId))
        ├── NicknameEntry.vue     (si no hay apodo O no hay sesión vigente para esta sala)
        └── ChatRoomConnected.vue (una vez hay clave + apodo + sesión)
              ├── KickedGate.vue      (si el voto de expulsion en curso me alcanzo a mi)
              ├── ReverifyBanner.vue  (si la sesión venció a mitad de conversación)
              ├── CapacityGate.vue    (conectando / sala llena / error)
              ├── ChatSidebar.vue     (lista de conectados + compartir enlace; drawer en mobile)
              │     └── OccupantList.vue  (boton de "votar expulsion" en cada ocupante)
              ├── ChatHeader.vue      (título + ocupantes, o "fulano está escribiendo...")
              ├── KickVoteBanner.vue  (voto activo - no tapa el resto del chat)
              ├── MessageList.vue → MessageBubble.vue / VaultCard.vue (intercalados por orden cronologico)
              │     └── AudioPlayer.vue (components/ui/ - reproductor propio, tambien usado por fileSharing/ViewContent.vue)
              ├── MessageComposer.vue  (texto + adjuntar imagen + grabar audio + compartir link)
              │     └── MediaSendPrompt.vue  (el fork "¿enviar en el chat o guardar en el Cofre?")
              └── VaultComposer.vue
```

## Expulsar por voto de mayoría — social, no criptográfico

Sin rol de "admin" (el chat es anónimo): cualquiera puede iniciar un voto para expulsar a otro participante, y si la mayoría de los conectados en ese momento vota que sí, se lo expulsa. Vive en `useKickVote.ts`, 100% Broadcast, cero cambios de backend. Aplicación **social/blanda**: un cliente modificado a mano podría ignorar el evento y seguir escuchando con su access token vigente (hasta 5 min). `ChatRoomMain.vue` chequea `fueExpulsado(roomId)` como primer gate, así ni un refresh deja reentrar a quien ya fue votado afuera.

## Imagen/audio: el fork chat-o-Cofre, y el endurecimiento anti-descarga

Compartir una imagen o un audio siempre pasa primero por `MediaSendPrompt.vue`, que pregunta si mandarlo como mensaje normal o guardarlo en el Cofre — ambos caminos sí pasan por el backend (sección 15 de `backend/README.md`), a diferencia del texto.

Descargar imagen/audio es **fricción, no una garantía criptográfica** — quien tiene DevTools abierto siempre puede interceptar los bytes ya descifrados en memoria; el objetivo es subir la valla contra el caso casual, no evitar una captura de pantalla (eso es inevitable y no se persigue):
- **Audio nunca usa `<audio src="...">` nativo.** `AudioPlayer.vue` + `composables/useAudioPlayer.ts` (sin carpeta de dominio, también la usa `fileSharing`) decodifican el `ArrayBuffer` con la Web Audio API y arman un reproductor propio — sin URL de archivo en el DOM ni botón nativo de descarga.
- **Imagen** bloquea el menú contextual y el arrastre (`@contextmenu.prevent`, `draggable="false"`, `user-select: none`). Se descartó `<canvas>`: los navegadores modernos ya permiten "Guardar imagen como" ahí también.

## Imagen del chat: oculta hasta tocarla, un solo vistazo para siempre

Solo en `MessageBubble.vue` (el Cofre no lo necesita, ver abajo). Llega como una caja opaca ("Toca para ver"); tocarla pide confirmación (`ConfirmModal.vue`, genérico) antes de revelar. Al aceptar, se muestra 5 segundos y se oculta sola — y queda bloqueada para siempre, un segundo toque no vuelve a mostrarla. Estado 100% local por-espectador, independiente del TTL propio del mensaje (que puede autodestruirlo antes de completar los 5s, en salas de TTL corto — misma tensión ya aceptada para audio). Al pasar a "ya vista" se revoca el Blob URL (`URL.revokeObjectURL`), así que forzar el estado con Vue Devtools tampoco vuelve a cargar la imagen real.

**Por qué el Cofre no lo usa**: ya gasta una copia contada por el servidor por cada revelado, compartida entre todos los de la sala — su propio mecanismo de "vista limitada", pensado para varias personas. Sumarle el bloqueo local de 5s sería redundante. El Cofre sí gana el endurecimiento anti-descarga de arriba.

## Otras decisiones

- **`ChatRoomConnected.vue` separado de `ChatRoomMain.vue`**: `useSecretChatRoom` registra un `onUnmounted`, necesita correr en el `setup()` de un componente que realmente se desmonte al salir — `ChatRoomMain.vue` todavía puede no tener apodo/sesión listos (`NicknameEntry.vue` los gatea), no es un punto seguro.
- **Cupo de sala (2-6)**: límite **blando** vía Presence de Supabase, del lado del cliente — no una garantía dura (`usePresenceCapacity.ts`, `backend/README.md` sección 12).
