<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import type { ResumenReaccion } from '../../composables/secretChat/useMessageReactions'
import { ahora } from '../../composables/secretChat/useTickingClock'
import { copiarAlPortapapeles } from '../../composables/useClipboard'
import { useLongPress } from '../../composables/useLongPress'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import AudioPlayer from '../ui/AudioPlayer.vue'
import ConfirmModal from '../ui/ConfirmModal.vue'
import MessageActionBar, { type RectoAncla } from './MessageActionBar.vue'

const props = withDefaults(
  defineProps<{
    mensaje: MensajeChat
    ttlSegundos: number
    reacciones?: ResumenReaccion[]
    visto?: boolean
  }>(),
  { reacciones: () => [], visto: false },
)
const emit = defineEmits<{ responder: [mensaje: MensajeChat]; reaccionar: [mensajeId: string, emoji: string] }>()

const { t } = useLocale()

// Reloj compartido (useTickingClock.ts, un solo setInterval para toda la
// sala, arrancado una vez desde ChatRoomConnected.vue) en vez de que cada
// burbuja tenga el suyo propio.
const restante = computed(() => {
  const transcurrido = Math.floor((ahora.value - props.mensaje.enviadoEn) / 1000)
  return Math.max(0, props.ttlSegundos - transcurrido)
})

const esImagen = computed(() => props.mensaje.tipo === 'media' && props.mensaje.mimeType?.startsWith('image/'))
const esTexto = computed(() => props.mensaje.tipo === 'texto')

// De un solo vistazo para siempre, no por-mensaje sino por-espectador (100%
// local, sin broadcast) - a diferencia del Cofre (que gasta una copia
// contada por el servidor y compartida por toda la sala), esto es "no
// dejarla abierta en pantalla", pensado para una sola persona mirando su
// propia pantalla. Independiente del TTL propio del mensaje: si la sala
// tiene un TTL corto, el mensaje puede autodestruirse antes de completar
// los 5s de vista, o incluso antes de poder tocarla - misma tension ya
// aceptada para audio+TTL corto (ver backend/README.md seccion 15), no se
// pausa la cuenta regresiva del mensaje por esto.
const DURACION_VISTA_MS = 5000
const revelada = ref(false)
const yaVista = ref(false)
const confirmando = ref(false)
let temporizadorVista: ReturnType<typeof setTimeout> | undefined

// Tocar la caja oculta no revela directo - primero confirma que entendio
// que es de un solo vistazo (ConfirmModal.vue), recien ahi arranca el
// temporizador de 5s.
function pedirConfirmacion() {
  if (yaVista.value || revelada.value) return
  confirmando.value = true
}

function confirmarRevelado() {
  confirmando.value = false
  revelada.value = true
  temporizadorVista = setTimeout(() => {
    revelada.value = false
    yaVista.value = true
    // El Blob URL sigue siendo el mismo objeto en memoria hasta que el
    // mensaje se autodestruye por su propio TTL - revocarlo aca (no solo
    // dejar de mostrarlo) evita que forzar `revelada` de nuevo desde fuera
    // de este componente (p.ej. Vue Devtools) vuelva a cargar la imagen real.
    if (props.mensaje.mediaUrl) URL.revokeObjectURL(props.mensaje.mediaUrl)
  }, DURACION_VISTA_MS)
}

onUnmounted(() => {
  if (temporizadorVista) clearTimeout(temporizadorVista)
})

// Menu de acciones (copiar/responder/reaccionar) - mantener presionado en
// mobile/tablet, boton "..." (click o hover) en desktop - los dos disparan
// el mismo menu (ver useLongPress.ts y el boton en el template). El rect se
// mide una sola vez al abrir (getBoundingClientRect de la burbuja), no es
// reactivo - MessageActionBar.vue lo usa para posicionarse via Teleport.
const elBurbuja = ref<HTMLElement | null>(null)
const menuAbierto = ref(false)
const anclaje = ref<RectoAncla | null>(null)

function abrirMenu() {
  if (!elBurbuja.value) return
  const rect = elBurbuja.value.getBoundingClientRect()
  anclaje.value = { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
  menuAbierto.value = true
}

function alternarMenu() {
  if (menuAbierto.value) {
    menuAbierto.value = false
  } else {
    abrirMenu()
  }
}

const {
  onPointerDown: onPressDown,
  onPointerMove: onPressMove,
  onPointerUp: onPressUp,
  onPointerLeave: onPressLeave,
} = useLongPress({ onLongPress: abrirMenu })

async function copiarTexto() {
  if (esTexto.value && props.mensaje.texto) await copiarAlPortapapeles(props.mensaje.texto)
  menuAbierto.value = false
}

function responderDesdeMenu() {
  emit('responder', props.mensaje)
  menuAbierto.value = false
}

function reaccionarDesdeMenu(emoji: string) {
  emit('reaccionar', props.mensaje.id, emoji)
  menuAbierto.value = false
}

// Swipe para responder (solo mensajes de texto, ver plan) - revela un
// icono mientras se arrastra, confirma al soltar pasado el umbral.
const UMBRAL_SWIPE_PX = 80
const {
  arrastrando,
  deltaX,
  onPointerDown: onSwipeDown,
  onPointerMove: onSwipeMove,
  onPointerUp: onSwipeUp,
  onPointerLeave: onSwipeLeave,
} = useSwipeGesture({
  direccion: 'derecha',
  umbralPx: UMBRAL_SWIPE_PX,
  onCommit: () => {
    if (esTexto.value) emit('responder', props.mensaje)
  },
})

function manejarPointerDown(evento: PointerEvent) {
  onPressDown(evento)
  onSwipeDown(evento)
}
function manejarPointerMove(evento: PointerEvent) {
  onPressMove(evento)
  onSwipeMove(evento)
}
function manejarPointerUp() {
  onPressUp()
  onSwipeUp()
}
function manejarPointerLeave() {
  onPressLeave()
  onSwipeLeave()
}
</script>

<template>
  <div class="message-bubble-wrap" :class="{ propio: mensaje.propio }">
    <span
      v-if="arrastrando && deltaX > 0"
      class="icono-swipe-responder"
      :style="{ opacity: Math.min(deltaX / UMBRAL_SWIPE_PX, 1) }"
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M9.53 3.22a.75.75 0 010 1.06L5.81 8h7.44a4.75 4.75 0 010 9.5H10a.75.75 0 010-1.5h3.25a3.25 3.25 0 000-6.5H5.81l3.72 3.72a.75.75 0 11-1.06 1.06l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 011.06 0z"
          clip-rule="evenodd"
        />
      </svg>
    </span>

    <div
      ref="elBurbuja"
      class="message-bubble"
      :class="{ propio: mensaje.propio }"
      :style="arrastrando ? { transform: `translateX(${deltaX}px)` } : undefined"
      @pointerdown="manejarPointerDown"
      @pointermove="manejarPointerMove"
      @pointerup="manejarPointerUp"
      @pointerleave="manejarPointerLeave"
    >
      <!-- El apodo propio nunca se muestra arriba de la burbuja, igual que
           WhatsApp en un grupo - ya se sabe de quien es por estar alineada a
           la derecha. -->
      <span v-if="!mensaje.propio" class="autor">{{ mensaje.autor }}</span>

      <div v-if="mensaje.respuestaA" class="respuesta-cita">
        <span class="respuesta-cita-autor">{{ mensaje.respuestaA.autor }}</span>
        <span class="respuesta-cita-extracto">{{ mensaje.respuestaA.extracto }}</span>
      </div>

      <template v-if="mensaje.tipo === 'media'">
        <template v-if="esImagen">
          <Transition name="revelar-imagen" mode="out-in">
            <img
              v-if="revelada"
              key="imagen"
              class="media-imagen"
              :src="mensaje.mediaUrl"
              alt=""
              draggable="false"
              @contextmenu.prevent
            />
            <button v-else-if="!yaVista" key="oculta" type="button" class="media-oculta" @click="pedirConfirmacion">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M10 1a4 4 0 00-4 4v2H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 6V5a2 2 0 10-4 0v2h4zm-2 4a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{{ t.chatImageTapToView }}</span>
            </button>
            <div v-else key="vista" class="media-oculta media-ya-vista">
              <span>{{ t.chatImageAlreadyViewed }}</span>
            </div>
          </Transition>
          <ConfirmModal
            v-if="confirmando"
            :titulo="t.chatImageConfirmTitle"
            :mensaje="t.chatImageConfirmMessage"
            :texto-aceptar="t.vaultViewButton"
            :texto-cancelar="t.mediaSendPromptCancel"
            @aceptar="confirmarRevelado"
            @cancelar="confirmando = false"
          />
        </template>
        <AudioPlayer v-else-if="mensaje.mediaDatos" :datos="mensaje.mediaDatos" />
      </template>
      <p v-else class="texto">{{ mensaje.texto }}</p>

      <div class="pie-burbuja">
        <span class="cuenta-regresiva">{{ restante }}s</span>
        <svg
          v-if="mensaje.propio && visto"
          class="icono-visto"
          :aria-label="t.messageSeenAria"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M17.03 5.72a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.97 2.97 6.97-6.97a.75.75 0 011.06 0z"
            clip-rule="evenodd"
          />
          <path
            fill-rule="evenodd"
            d="M13.03 5.72a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06 0l-1.5-1.5a.75.75 0 111.06-1.06l.97.97 6.97-6.97a.75.75 0 011.06 0z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>

    <div v-if="reacciones.length" class="reacciones-fila">
      <button
        v-for="r in reacciones"
        :key="r.emoji"
        type="button"
        class="pill-reaccion"
        :class="{ propia: r.propia }"
        @click="emit('reaccionar', mensaje.id, r.emoji)"
      >
        {{ r.emoji }} {{ r.cantidad }}
      </button>
    </div>

    <button type="button" class="boton-mas" :aria-label="t.messageActionsAria" @click="alternarMenu">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 6a2 2 0 100-4 2 2 0 000 4zM10 12a2 2 0 100-4 2 2 0 000 4zM10 18a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
    </button>

    <MessageActionBar
      v-if="menuAbierto && anclaje"
      :anclaje="anclaje"
      :alinear-derecha="mensaje.propio"
      :solo-reacciones="!esTexto"
      @copiar="copiarTexto"
      @responder="responderDesdeMenu"
      @reaccionar="reaccionarDesdeMenu"
      @cerrar="menuAbierto = false"
    />
  </div>
</template>

<style scoped>
.message-bubble-wrap {
  position: relative;
  align-self: flex-start;
  max-width: min(78%, 34rem);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.message-bubble-wrap.propio {
  align-self: flex-end;
}

.message-bubble {
  padding: 0.5rem 0.75rem 0.375rem;
  /* Radio asimetrico (una esquina inferior mas cerrada) - la referencia
     visual de "cola" de burbuja de chat, sin necesitar un pseudo-elemento. */
  border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) 3px;
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
  touch-action: pan-y;
}

.message-bubble.propio {
  border-radius: var(--radius-sm) var(--radius-sm) 3px var(--radius-sm);
  background: var(--accent-gradient);
}

.message-bubble.propio .texto {
  color: var(--accent-contrast);
}

.message-bubble.propio .cuenta-regresiva {
  color: rgba(255, 255, 255, 0.75);
}

.autor {
  display: block;
  margin-bottom: 0.125rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
}

.respuesta-cita {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  margin-bottom: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-left: 2px solid currentColor;
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 10%, transparent);
  opacity: 0.85;
}

.respuesta-cita-autor {
  font-size: 0.6875rem;
  font-weight: 600;
}

.respuesta-cita-extracto {
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.texto {
  color: var(--text-h);
  font-size: 0.9375rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.media-imagen {
  display: block;
  max-width: 100%;
  max-height: 20rem;
  border-radius: 3px;
  object-fit: contain;
  /* Friccion deliberada contra "Guardar imagen como"/arrastrar - no es una
     garantia (ver secretChat/README.md), solo sube la valla del caso casual. */
  -webkit-user-drag: none;
  -webkit-touch-callout: none;
  user-select: none;
}

.media-oculta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 12rem;
  height: 8rem;
  border: none;
  border-radius: 3px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;
}

.media-oculta svg {
  width: 1.25rem;
  height: 1.25rem;
}

.media-ya-vista {
  cursor: default;
  opacity: 0.6;
}

.revelar-imagen-enter-active,
.revelar-imagen-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.revelar-imagen-enter-from,
.revelar-imagen-leave-to {
  opacity: 0;
}

.pie-burbuja {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  margin-top: 0.1875rem;
}

.cuenta-regresiva {
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.icono-visto {
  width: 0.875rem;
  height: 0.875rem;
  color: rgba(255, 255, 255, 0.75);
}

.icono-swipe-responder {
  position: absolute;
  top: 50%;
  left: -1.75rem;
  transform: translateY(-50%);
  display: flex;
  color: var(--accent);
}

.icono-swipe-responder svg {
  width: 1.125rem;
  height: 1.125rem;
}

.reacciones-fila {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.pill-reaccion {
  display: flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-surface);
  color: var(--text);
  font-size: 0.75rem;
  cursor: pointer;
}

.pill-reaccion.propia {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-surface));
}

/* Solo en dispositivos con hover real (mouse) - en touch queda oculto del
   todo (el long-press ya abre el mismo menu, ver useLongPress.ts). El
   problema anterior no era el hover en si - era que el menu se cerraba
   solo apenas se abria (bug ya arreglado en useLongPress.ts); no hacia
   falta dejarlo siempre visible para solucionar eso. */
.boton-mas {
  display: none;
  position: absolute;
  top: -0.375rem;
  right: -0.375rem;
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg-surface);
  color: var(--text-muted);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.message-bubble-wrap.propio .boton-mas {
  right: auto;
  left: -0.375rem;
}

.boton-mas svg {
  width: 0.875rem;
  height: 0.875rem;
}

@media (hover: hover) {
  .boton-mas {
    display: flex;
  }

  .message-bubble-wrap:hover .boton-mas {
    opacity: 1;
  }
}
</style>
