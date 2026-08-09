<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { useRoomKey } from '../../composables/secretChat/useRoomKey'
import { useRoomNickname } from '../../composables/secretChat/useRoomNickname'
import { fueExpulsado, hasValidSession } from '../../composables/secretChat/useRoomSession'
import ChatRoomConnected from './ChatRoomConnected.vue'
import ConnectingIndicator from './ConnectingIndicator.vue'
import KickedGate from './KickedGate.vue'
import NicknameEntry from './NicknameEntry.vue'

const props = defineProps<{ roomId: string }>()

const { t } = useLocale()
const { clave, cargando: cargandoClave, error: errorClave } = useRoomKey()
const { apodo, guardar } = useRoomNickname(props.roomId)

// cap/ttl/pwd viajan en el query string, no en el fragmento: a diferencia
// de la clave, no son secretos - es la unica forma de que quien se une
// conozca la configuracion que eligio el creador sin que exista una tabla
// de "salas" en el backend para las que no tienen contraseña (ver
// backend/README.md seccion 14). Se clampean por si alguien edita la URL
// a mano.
const parametros = new URLSearchParams(window.location.search)

const capacidadMaxima = computed(() => {
  const valor = Number(parametros.get('cap'))
  return Number.isInteger(valor) && valor >= 2 && valor <= 6 ? valor : 4
})

const ttlSegundos = computed(() => {
  const valor = Number(parametros.get('ttl'))
  return Number.isInteger(valor) && valor >= 5 && valor <= 60 ? valor : 15
})

const requierePassword = computed(() => parametros.get('pwd') === '1')

// ChatRoomConnected.vue exige `clave: CryptoKey` (no nullable) - este
// computed solo se lee cuando ya se paso el guard de cargandoClave/errorClave
// (clave.value esta garantizado no-null en ese punto), pero TypeScript no
// puede inferir eso a traves de un v-if en el template. Se resuelve aca (un
// assert de tipo comun en TS para esto, no un fallback real) para no
// necesitar un "clave!" en el template, que el parser de expresiones de Vue
// rechaza como sintaxis invalida.
const claveResuelta = computed((): CryptoKey => clave.value as CryptoKey)

// Ref plano (no computed): sessionStorage no es reactivo para Vue, asi que
// se lee una sola vez al montar y despues se actualiza a mano apenas
// NicknameEntry.vue confirma un desafio de Turnstile exitoso - mismo
// criterio que `apodo` (useRoomNickname), tambien un ref plano actualizado
// imperativamente via `guardar`.
const sesionLista = ref(hasValidSession(props.roomId))

function manejarConfirmacion(nuevoApodo: string) {
  guardar(nuevoApodo)
  sesionLista.value = true
}
</script>

<template>
  <!-- Un unico contenedor de pantalla completa para TODO el ciclo de vida
       de la sala (cargando clave -> apodo -> conectando -> conectado) - el
       tamaño/posicion nunca cambia, solo el contenido de adentro, via
       Transition. Sin esto, pasar de un estado chico centrado a la
       ventana de chat final se sentia como un salto brusco de layout. -->
  <div class="chat-app-shell">
    <Transition name="fade-swap" mode="out-in">
      <div v-if="fueExpulsado(roomId)" key="expulsado" class="gate-centrado">
        <KickedGate />
      </div>

      <div v-else-if="cargandoClave" key="cargando" class="gate-centrado">
        <ConnectingIndicator :texto="t.viewLoading" />
      </div>

      <div v-else-if="errorClave" key="error" class="gate-centrado">
        <h2>{{ t.chatLinkInvalidHeading }}</h2>
        <p class="subtitulo">{{ t.chatLinkInvalidSubtitle }}</p>
      </div>

      <div v-else-if="!apodo || !sesionLista" key="nickname" class="gate-centrado">
        <NicknameEntry :room-id="roomId" :requiere-password="requierePassword" @confirmar="manejarConfirmacion" />
      </div>

      <ChatRoomConnected
        v-else
        key="conectado"
        :room-id="roomId"
        :clave="claveResuelta"
        :apodo="apodo"
        :capacidad-maxima="capacidadMaxima"
        :ttl-segundos="ttlSegundos"
        :requiere-password="requierePassword"
      />
    </Transition>
  </div>
</template>

<style scoped>
.chat-app-shell {
  /* 100% (no 100vh): vive dentro de .app-content--chat en App.vue, que ya
     es un flex:1 exactamente del alto disponible - un valor fijo aca
     asumiria que este componente siempre es el hijo directo de la
     ventana, en vez de heredar lo que el padre real le de. */
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-surface);
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

.subtitulo {
  color: var(--text-muted);
  font-size: 0.9375rem;
}

.fade-swap-enter-active,
.fade-swap-leave-active {
  transition: opacity var(--duration-base) var(--ease-out);
}

.fade-swap-enter-from,
.fade-swap-leave-to {
  opacity: 0;
}
</style>
