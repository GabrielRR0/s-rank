<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import type { VaultPointer } from '../../composables/secretChat/useSecretChatRoom'
import MessageBubble from './MessageBubble.vue'
import VaultCard from './VaultCard.vue'

const props = defineProps<{ mensajes: MensajeChat[]; vaults: VaultPointer[]; clave: CryptoKey; ttlSegundos: number }>()
const emit = defineEmits<{ copiado: [vaultId: string, copiasRestantes: number] }>()

function manejarCopiado(vaultId: string, copiasRestantes: number) {
  emit('copiado', vaultId, copiasRestantes)
}

// El Cofre no es un panel separado - es "un mensaje mas" dentro del mismo
// scroll, solo que con otro estilo (ver VaultCard.vue). Se intercala por
// orden cronologico junto a los mensajes normales, no se agrupa aparte.
type ItemLista =
  | { key: string; tipo: 'mensaje'; ts: number; mensaje: MensajeChat }
  | { key: string; tipo: 'vault'; ts: number; vault: VaultPointer }

const itemsCombinados = computed<ItemLista[]>(() => {
  const items: ItemLista[] = [
    ...props.mensajes.map((mensaje): ItemLista => ({ key: `m:${mensaje.id}`, tipo: 'mensaje', ts: mensaje.enviadoEn, mensaje })),
    ...props.vaults.map((vault): ItemLista => ({ key: `v:${vault.vaultId}`, tipo: 'vault', ts: vault.creadoEn, vault })),
  ]
  return items.sort((a, b) => a.ts - b.ts)
})

const contenedor = ref<HTMLDivElement | null>(null)

watch(
  () => itemsCombinados.value.length,
  async () => {
    await nextTick()
    if (contenedor.value) contenedor.value.scrollTop = contenedor.value.scrollHeight
  },
)
</script>

<template>
  <div ref="contenedor" class="message-list">
    <TransitionGroup name="mensaje-fade">
      <template v-for="item in itemsCombinados">
        <MessageBubble
          v-if="item.tipo === 'mensaje'"
          :key="item.key"
          :mensaje="item.mensaje"
          :ttl-segundos="ttlSegundos"
        />
        <VaultCard v-else :key="item.key" :vault="item.vault" :clave="clave" @copiado="manejarCopiado" />
      </template>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  overflow-y: auto;
  padding: 1rem;
}

/* Llegada: fundido + deslizamiento + un leve "pop" de escala - mas
   perceptible que un fundido chico, para que se sienta como el mensaje
   "entrando" de verdad en vez de aparecer de golpe. Se aplica por igual a
   burbujas normales y a tarjetas del Cofre - mismo lenguaje visual, una
   sola lista. */
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
