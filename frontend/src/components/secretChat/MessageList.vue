<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import type { ResumenReaccion } from '../../composables/secretChat/useMessageReactions'
import type { VaultPointer } from '../../composables/secretChat/useSecretChatRoom'
import { formatearSeparadorFecha, sonMismoDia } from '../../utils/secretChat/formatearSeparadorFecha'
import MessageBubble from './MessageBubble.vue'
import VaultCard from './VaultCard.vue'

const props = defineProps<{
  mensajes: MensajeChat[]
  vaults: VaultPointer[]
  clave: CryptoKey
  ttlSegundos: number
  noVistos: number
  reaccionesPorMensaje: Record<string, ResumenReaccion[]>
  esVisto: (mensajeId: string) => boolean
}>()
const emit = defineEmits<{
  copiado: [vaultId: string, copiasRestantes: number]
  'todo-visto': []
  responder: [mensaje: MensajeChat]
  reaccionar: [mensajeId: string, emoji: string]
}>()

const { locale } = useLocale()

function manejarCopiado(vaultId: string, copiasRestantes: number) {
  emit('copiado', vaultId, copiasRestantes)
}

// El Cofre no es un panel separado - es "un mensaje mas" dentro del mismo
// scroll, solo que con otro estilo (ver VaultCard.vue). Se intercala por
// orden cronologico junto a los mensajes normales, no se agrupa aparte.
// Los separadores de fecha son un tercer tipo de item, insertados en un
// segundo paso una vez que mensajes+vaults ya estan ordenados.
type ItemLista =
  | { key: string; tipo: 'mensaje'; ts: number; mensaje: MensajeChat }
  | { key: string; tipo: 'vault'; ts: number; vault: VaultPointer }
  | { key: string; tipo: 'separador'; ts: number; fecha: string }

const itemsCombinados = computed<ItemLista[]>(() => {
  const base: ItemLista[] = [
    ...props.mensajes.map((mensaje): ItemLista => ({ key: `m:${mensaje.id}`, tipo: 'mensaje', ts: mensaje.enviadoEn, mensaje })),
    ...props.vaults.map((vault): ItemLista => ({ key: `v:${vault.vaultId}`, tipo: 'vault', ts: vault.creadoEn, vault })),
  ]
  base.sort((a, b) => a.ts - b.ts)

  const conSeparadores: ItemLista[] = []
  let anterior: ItemLista | null = null
  for (const item of base) {
    if (!anterior || !sonMismoDia(anterior.ts, item.ts)) {
      conSeparadores.push({ key: `sep:${item.key}`, tipo: 'separador', ts: item.ts, fecha: formatearSeparadorFecha(item.ts, locale.value) })
    }
    conSeparadores.push(item)
    anterior = item
  }
  return conSeparadores
})

const contenedor = ref<HTMLDivElement | null>(null)
// Cerca del fondo por defecto: al entrar a una sala la lista arranca vacia
// (el chat es 100% en vivo, sin historial - ver useEphemeralMessages.ts),
// asi que "cerca del fondo" es lo correcto hasta que se demuestre lo
// contrario con un scroll real.
const cercaDelFondo = ref(true)
const UMBRAL_FONDO_PX = 80

function actualizarCercaDelFondo() {
  const el = contenedor.value
  if (!el) return
  cercaDelFondo.value = el.scrollHeight - el.scrollTop - el.clientHeight < UMBRAL_FONDO_PX
  if (cercaDelFondo.value && props.noVistos > 0) emit('todo-visto')
}

function irAlFondo() {
  const el = contenedor.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  cercaDelFondo.value = true
  emit('todo-visto')
}

watch(
  () => itemsCombinados.value.length,
  async () => {
    // Se lee ANTES de nextTick (antes de que el DOM ya tenga el item
    // nuevo/el separador) - decide segun donde estaba la persona ANTES de
    // que llegara esto, no despues (que siempre da "cerca", porque el
    // contenido nuevo agranda scrollHeight).
    const seguirElFondo = cercaDelFondo.value
    await nextTick()
    if (!contenedor.value) return
    if (seguirElFondo) {
      contenedor.value.scrollTop = contenedor.value.scrollHeight
      if (props.noVistos > 0) emit('todo-visto')
    }
    // Si no seguia el fondo, no se toca el scroll - el contador de no
    // vistos ya lo maneja quien recibe el mensaje (useSecretChatRoom.ts),
    // aca solo se muestra el pill (ver template) mientras props.noVistos > 0.
  },
)
</script>

<template>
  <div ref="contenedor" class="message-list" @scroll="actualizarCercaDelFondo">
    <TransitionGroup name="mensaje-fade">
      <template v-for="item in itemsCombinados">
        <div v-if="item.tipo === 'separador'" :key="item.key" class="separador-fecha">
          <span>{{ item.fecha }}</span>
        </div>
        <MessageBubble
          v-else-if="item.tipo === 'mensaje'"
          :key="item.key"
          :mensaje="item.mensaje"
          :ttl-segundos="ttlSegundos"
          :reacciones="reaccionesPorMensaje[item.mensaje.id] ?? []"
          :visto="esVisto(item.mensaje.id)"
          @responder="emit('responder', $event)"
          @reaccionar="(mensajeId, emoji) => emit('reaccionar', mensajeId, emoji)"
        />
        <VaultCard v-else :key="item.key" :vault="item.vault" :clave="clave" @copiado="manejarCopiado" />
      </template>
    </TransitionGroup>

    <button v-if="!cercaDelFondo && noVistos > 0" type="button" class="pill-nuevos" @click="irAlFondo">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 11.586V4a1 1 0 011-1z"
        />
      </svg>
      {{ noVistos }}
    </button>
  </div>
</template>

<style scoped>
.message-list {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  overflow-y: auto;
  padding: 1rem;
}

.separador-fecha {
  align-self: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Flotante sobre el final de la lista - solo aparece si la persona esta
   scrolleada para arriba Y hay mensajes que no vio (ver template). */
.pill-nuevos {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: none;
  border-radius: 999px;
  background: var(--accent-gradient);
  box-shadow: var(--shadow-glow-sm);
  color: var(--accent-contrast);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.pill-nuevos svg {
  width: 1rem;
  height: 1rem;
}

/* Llegada: fundido + deslizamiento + un leve "pop" de escala - mas
   perceptible que un fundido chico, para que se sienta como el mensaje
   "entrando" de verdad en vez de aparecer de golpe. Se aplica por igual a
   burbujas normales, tarjetas del Cofre y separadores de fecha - mismo
   lenguaje visual, una sola lista. */
.mensaje-fade-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.mensaje-fade-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}

/* Reacomodo de los demas items cuando uno se autodestruye/agota (tecnica
   FLIP de Vue) - sin esto, el resto de la lista "salta" de golpe a su nueva
   posicion en vez de deslizarse. */
.mensaje-fade-move {
  transition: transform var(--duration-base) var(--ease-out);
}

/* Autodestruccion/agotamiento: un "pop" chico hacia afuera antes de
   encogerse y desvanecerse girando - intuitivo (se nota que algo
   "estallo"/desaparecio) sin agregar nada mas que transform/opacity. */
.mensaje-fade-leave-active {
  position: absolute;
  animation: autodestruir 450ms var(--ease-out) both;
}

@keyframes autodestruir {
  0% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: scale(1.08) rotate(-2deg);
  }
  100% {
    opacity: 0;
    transform: scale(0.35) rotate(-12deg) translateY(6px);
  }
}
</style>
