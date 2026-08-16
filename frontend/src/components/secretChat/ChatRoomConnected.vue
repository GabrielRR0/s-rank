<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSecretChatRoom } from '../../composables/secretChat/useSecretChatRoom'
import CapacityGate from './CapacityGate.vue'
import ChatHeader from './ChatHeader.vue'
import ChatSidebar from './ChatSidebar.vue'
import KickedGate from './KickedGate.vue'
import KickVoteBanner from './KickVoteBanner.vue'
import MessageComposer from './MessageComposer.vue'
import MessageList from './MessageList.vue'
import NotifyInstallBanner from './NotifyInstallBanner.vue'
import ReverifyBanner from './ReverifyBanner.vue'
import VaultComposer from './VaultComposer.vue'

const props = defineProps<{
  roomId: string
  clave: CryptoKey
  apodo: string
  capacidadMaxima: number
  ttlSegundos: number
  requierePassword: boolean
}>()

// Se instancia aca (no en ChatRoomMain.vue) porque useSecretChatRoom llama
// a onUnmounted internamente - necesita correr durante el setup() sincrono
// de un componente que efectivamente se vaya a desmontar cuando la sala se
// abandona. ChatRoomMain.vue solo renderiza este componente una vez que ya
// hay clave + apodo + sesion listos, asi que ese momento coincide
// exactamente con "cuando conviene conectar".
const {
  mensajes,
  vaults,
  estado,
  estadoAuth,
  reintentarAuth,
  ocupantes,
  listaOcupantes,
  miClavePresencia,
  escribiendo,
  votoActivo,
  expulsado,
  enviarMensaje,
  enviarMedia,
  compartirVault,
  notificarCopiaVault,
  notificarEscribiendo,
  iniciarVoto,
  votar,
} = useSecretChatRoom(props.roomId, props.clave, props.apodo, {
  capacidadMaxima: props.capacidadMaxima,
  ttlSegundos: props.ttlSegundos,
})

// Solo importa en mobile (ver ChatSidebar.vue) - en desktop el sidebar esta
// siempre visible, este estado no se usa para nada ahi.
const sidebarAbierta = ref(false)

// Misma formula que useKickVote.ts (recalculada aca solo para mostrarla en
// el banner, la logica real de si ya se alcanzo vive en el composable).
const mayoriaVoto = computed(() => Math.floor(listaOcupantes.value.length / 2) + 1)
</script>

<template>
  <!-- Raiz unica que ocupa siempre el 100% del alto que le da
       ChatRoomMain.vue (ver ese archivo) - el Transition de abajo solo
       cambia el contenido interno (gate centrado o la ventana de chat de 2
       columnas), nunca el tamaño/posicion de este contenedor, para que la
       conexion se sienta como una sola pantalla que se completa, no un
       salto de layout. -->
  <div class="chat-window-shell">
    <Transition name="fade-swap" mode="out-in">
      <div v-if="expulsado" key="expulsado" class="gate-centrado">
        <KickedGate />
      </div>

      <div v-else-if="estadoAuth === 'requiere-reverificacion'" key="reverify" class="gate-centrado">
        <ReverifyBanner :room-id="roomId" :requiere-password="requierePassword" @verificado="reintentarAuth" />
      </div>

      <div v-else-if="estado !== 'conectado'" key="capacidad" class="gate-centrado">
        <CapacityGate :estado="estado" />
      </div>

      <div v-else key="conectado" class="chat-window">
        <ChatSidebar
          :ocupantes="listaOcupantes"
          :abierto="sidebarAbierta"
          :objetivo-voto="votoActivo?.objetivoClavePresencia ?? null"
          @cerrar="sidebarAbierta = false"
          @iniciar-voto="iniciarVoto"
        />

        <div class="panel-principal">
          <ChatHeader
            :ocupantes="ocupantes"
            :capacidad-maxima="capacidadMaxima"
            :nombres-escribiendo="escribiendo"
            @abrir-sidebar="sidebarAbierta = true"
          />

          <Transition name="banner-voto">
            <KickVoteBanner
              v-if="votoActivo"
              :voto="votoActivo"
              :mi-clave-presencia="miClavePresencia"
              :mayoria="mayoriaVoto"
              @votar="votar"
            />
          </Transition>

          <NotifyInstallBanner />

          <div class="chat-body">
            <MessageList
              :mensajes="mensajes"
              :vaults="vaults"
              :clave="clave"
              :ttl-segundos="ttlSegundos"
              @copiado="notificarCopiaVault"
            />
          </div>

          <div class="chat-footer">
            <VaultComposer :clave="clave" :room-id="roomId" @compartido="compartirVault" />
            <MessageComposer
              :clave="clave"
              :room-id="roomId"
              @enviar="enviarMensaje"
              @escribiendo="notificarEscribiendo"
              @enviar-media="enviarMedia"
              @compartido="compartirVault"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.chat-window-shell {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.gate-centrado {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  text-align: center;
}

.chat-window {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: row;
  position: relative;
  background: var(--bg-surface);
}

/* El fondo (textura de puntos + --bg) vive aca, no en .chat-body - header y
   footer son paneles translucidos con blur que se superponen a ESTE mismo
   fondo compartido, en vez de cada uno definir su propio color. Sin esto,
   .chat-footer terminaba con un tono ligeramente distinto al de .chat-body
   (bg-surface vs bg), notandose como un parche en vez de una sola superficie
   continua vista a traves de dos paneles de vidrio. */
.panel-principal {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--accent) 12%, transparent) 1px, transparent 0) 0 0 /
      18px 18px,
    var(--bg);
}

.chat-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Panel de vidrio, mismo lenguaje que .app-topbar en App.vue: translucido +
   blur en vez de una superficie solida, separado del area de mensajes con
   un borde superior apenas visible (no una linea dura) en vez de un bloque
   opaco pegado abajo. */
.chat-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  /* env(safe-area-inset-bottom) (0 si el navegador no lo soporta, cae al
     0.75rem de arriba) - en iOS la barra flotante inferior de Safari se
     superpone al contenido en vez de encogerle el viewport, tapando el
     composer sin este colchon extra. Necesita viewport-fit=cover en
     index.html; sin eso env() siempre da 0. */
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
  border-top: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  /* --bg (no --bg-surface) para matchear el mismo fondo de .panel-principal
     que se ve a traves de .chat-body - y un toque de --accent mezclado
     adentro, sin el cual se leia como gris plano en vez del violeta del
     resto de la app, sobre todo semi-transparente. Mismo truco que
     .vault-card. */
  background: color-mix(in srgb, var(--accent) 8%, color-mix(in srgb, var(--bg) 62%, transparent));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* En mobile ya no flota separado con margen propio - queda al ras de los
   bordes igual que .chat-body (mismo fondo compartido, ver .panel-principal
   arriba), solo con las esquinas de arriba redondeadas (asimetricas a
   proposito) para separarse visualmente del area de mensajes. */
@media (max-width: 480px) {
  .chat-footer {
    border-radius: 28px 20px 0 0;
  }
}

.fade-swap-enter-active,
.fade-swap-leave-active {
  transition: opacity var(--duration-base) var(--ease-out);
}

.fade-swap-enter-from,
.fade-swap-leave-to {
  opacity: 0;
}

.banner-voto-enter-active,
.banner-voto-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.banner-voto-enter-from,
.banner-voto-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
