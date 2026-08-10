<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import AudioPlayer from '../ui/AudioPlayer.vue'
import ConfirmModal from '../ui/ConfirmModal.vue'

const props = defineProps<{ mensaje: MensajeChat; ttlSegundos: number }>()
const { t } = useLocale()

function calcularRestante(): number {
  const transcurrido = Math.floor((Date.now() - props.mensaje.enviadoEn) / 1000)
  return Math.max(0, props.ttlSegundos - transcurrido)
}

const restante = ref(calcularRestante())
let intervalo: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  intervalo = setInterval(() => {
    restante.value = calcularRestante()
  }, 1000)
})

onUnmounted(() => {
  if (intervalo) clearInterval(intervalo)
})

const esImagen = computed(() => props.mensaje.tipo === 'media' && props.mensaje.mimeType?.startsWith('image/'))

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
</script>

<template>
  <div class="message-bubble" :class="{ propio: mensaje.propio }">
    <!-- El apodo propio nunca se muestra arriba de la burbuja, igual que
         WhatsApp en un grupo - ya se sabe de quien es por estar alineada a
         la derecha. -->
    <span v-if="!mensaje.propio" class="autor">{{ mensaje.autor }}</span>
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
    <span class="cuenta-regresiva">{{ restante }}s</span>
  </div>
</template>

<style scoped>
.message-bubble {
  align-self: flex-start;
  max-width: min(78%, 34rem);
  padding: 0.5rem 0.75rem 0.375rem;
  /* Radio asimetrico (una esquina inferior mas cerrada) - la referencia
     visual de "cola" de burbuja de chat, sin necesitar un pseudo-elemento. */
  border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) 3px;
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
}

.message-bubble.propio {
  align-self: flex-end;
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

.cuenta-regresiva {
  display: block;
  margin-top: 0.1875rem;
  text-align: right;
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
