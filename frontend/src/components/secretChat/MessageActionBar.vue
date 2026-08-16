<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { EMOJIS_REACCION } from '../../composables/secretChat/useMessageReactions'

// Rect plano (no un DOMRect real) - MessageBubble.vue lo arma con
// getBoundingClientRect() de la burbuja al momento de abrir el menu, una
// sola vez (no reactivo: si la lista scrollea con el menu abierto, se
// cierra solo en vez de perseguir la posicion, ver ChatRoomConnected.vue).
export interface RectoAncla {
  top: number
  bottom: number
  left: number
  right: number
}

// Teleport a <body> + fondo oscurecido en vez de un dropdown local -
// escapa del scroll/stacking context de .message-list y se superpone a
// toda la conversacion, como el menu de mantener presionado de WhatsApp.
// Disparado por useLongPress en mobile y por el boton "..." al hover en
// desktop - ver MessageBubble.vue.
const props = withDefaults(
  defineProps<{ anclaje: RectoAncla; alinearDerecha?: boolean; soloReacciones?: boolean }>(),
  { alinearDerecha: false, soloReacciones: false },
)
const emit = defineEmits<{ copiar: []; responder: []; reaccionar: [emoji: string]; cerrar: [] }>()

const { t } = useLocale()

// Estimacion (el contenido real todavia no se renderizo) - alcanza para
// decidir si conviene abrir hacia abajo o hacia arriba sin cortarse contra
// el borde de la pantalla.
const ALTO_ESTIMADO_PX = 260
const GAP_PX = 8

const abrirArriba = props.anclaje.bottom + ALTO_ESTIMADO_PX + GAP_PX > window.innerHeight
const estilo = {
  ...(abrirArriba
    ? { bottom: `${Math.max(GAP_PX, window.innerHeight - props.anclaje.top + GAP_PX)}px` }
    : { top: `${props.anclaje.bottom + GAP_PX}px` }),
  ...(props.alinearDerecha
    ? { right: `${Math.max(GAP_PX, window.innerWidth - props.anclaje.right)}px` }
    : { left: `${props.anclaje.left}px` }),
  transformOrigin: `${abrirArriba ? 'bottom' : 'top'} ${props.alinearDerecha ? 'right' : 'left'}`,
}

function manejarTecla(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cerrar')
}

onMounted(() => document.addEventListener('keydown', manejarTecla))
onUnmounted(() => document.removeEventListener('keydown', manejarTecla))
</script>

<template>
  <Teleport to="body">
    <Transition name="fondo-fade" appear>
      <div class="fondo-oscurecido" @click="emit('cerrar')" />
    </Transition>
    <Transition name="menu-nativo" appear>
      <div class="message-action-bar" role="menu" :aria-label="t.messageActionsAria" :style="estilo">
        <div class="fila-emojis" :aria-label="t.messageActionReactAria">
          <button
            v-for="emoji in EMOJIS_REACCION"
            :key="emoji"
            type="button"
            class="boton-emoji"
            @click="emit('reaccionar', emoji)"
          >
            {{ emoji }}
          </button>
        </div>
        <div v-if="!soloReacciones" class="fila-acciones">
          <button type="button" class="boton-accion" role="menuitem" @click="emit('responder')">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M9.53 3.22a.75.75 0 010 1.06L5.81 8h7.44a4.75 4.75 0 010 9.5H10a.75.75 0 010-1.5h3.25a3.25 3.25 0 000-6.5H5.81l3.72 3.72a.75.75 0 11-1.06 1.06l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 011.06 0z"
                clip-rule="evenodd"
              />
            </svg>
            {{ t.messageActionReply }}
          </button>
          <button type="button" class="boton-accion" role="menuitem" @click="emit('copiar')">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M7 3.5A1.5 1.5 0 018.5 2h7A1.5 1.5 0 0117 3.5v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 12.5v-9z" />
              <path
                d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5V15h-1.5v1.5h-7v-9H6V6H4.5z"
              />
            </svg>
            {{ t.messageActionCopy }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fondo-oscurecido {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.fondo-fade-enter-active,
.fondo-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-out);
}

.fondo-fade-enter-from,
.fondo-fade-leave-to {
  opacity: 0;
}

.message-action-bar {
  position: fixed;
  z-index: 101;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
  max-width: min(88vw, 18rem);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
}

/* Entrada tipo "pop" nativo (leve rebote via cubic-bezier) - la salida es
   simple/rapida, sin rebote, mismo criterio que la mayoria de menus
   contextuales nativos (aparecer con personalidad, desaparecer sin drama). */
.menu-nativo-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) cubic-bezier(0.34, 1.56, 0.64, 1);
}

.menu-nativo-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.menu-nativo-enter-from,
.menu-nativo-leave-to {
  opacity: 0;
  transform: scale(0.85) translateY(6px);
}

.fila-emojis {
  display: flex;
  gap: 0.125rem;
}

.boton-emoji {
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 1.25rem;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.boton-emoji:hover {
  background: var(--bg-inset);
}

.fila-acciones {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
  padding-top: 0.375rem;
}

.boton-accion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  background: none;
  color: var(--text-h);
  font: inherit;
  font-size: 0.8125rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.boton-accion svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--text-muted);
}

.boton-accion:hover {
  background: var(--bg-inset);
}
</style>
