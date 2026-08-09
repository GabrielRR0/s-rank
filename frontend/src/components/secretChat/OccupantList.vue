<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'
import type { Ocupante } from '../../composables/secretChat/usePresenceCapacity'

defineProps<{ ocupantes: Ocupante[]; objetivoVoto: string | null }>()
const emit = defineEmits<{ 'iniciar-voto': [clavePresencia: string] }>()

const { t } = useLocale()

function inicial(apodo: string): string {
  return apodo.charAt(0).toUpperCase()
}

// Paleta fija (no --accent) para que cada participante se distinga de un
// vistazo en la lista - hash simple y determinista sobre el apodo, asi el
// mismo apodo siempre cae en el mismo color para todos los que ven la sala.
const PALETA_AVATAR = ['#ff5fa2', '#4dd8c0', '#f5a623', '#5b9dff', '#8de35a']

function colorParaApodo(apodo: string): string {
  let hash = 0
  for (const char of apodo) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return PALETA_AVATAR[Math.abs(hash) % PALETA_AVATAR.length]
}
</script>

<template>
  <TransitionGroup tag="ul" name="ocupante-fade" class="occupant-list">
    <li
      v-for="ocupante in ocupantes"
      :key="ocupante.clavePresencia"
      class="fila"
      :class="{ 'objetivo-voto': ocupante.clavePresencia === objetivoVoto }"
    >
      <span
        class="avatar"
        :class="{ propio: ocupante.propio }"
        :style="ocupante.propio ? undefined : { background: colorParaApodo(ocupante.apodo) }"
        aria-hidden="true"
        >{{ inicial(ocupante.apodo) }}</span
      >
      <span class="apodo">
        {{ ocupante.apodo }}
        <span v-if="ocupante.propio" class="sufijo-vos">{{ t.chatSidebarYouSuffix }}</span>
      </span>
      <button
        v-if="!ocupante.propio"
        type="button"
        class="boton-expulsar"
        :aria-label="t.chatKickButtonAria.replace('{apodo}', ocupante.apodo)"
        :title="t.chatKickButtonAria.replace('{apodo}', ocupante.apodo)"
        @click="emit('iniciar-voto', ocupante.clavePresencia)"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.72-8.78a.75.75 0 011.06 0L10 9.94l.66-.72a.75.75 0 111.08 1.04l-.63.69.63.69a.75.75 0 11-1.08 1.04L10 12.06l-.66.72a.75.75 0 01-1.08-1.04l.63-.69-.63-.69a.75.75 0 010-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </li>
  </TransitionGroup>
</template>

<style scoped>
.occupant-list {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
}

.fila {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
}

.fila:hover {
  background: var(--bg);
}

/* Objetivo de un voto de expulsion activo - senal clara de "esta persona
   esta siendo votada" directo en la lista, ademas del banner de arriba
   (ver KickVoteBanner.vue). Pulso sutil, solo opacity, para no depender de
   un color nuevo fuera de la paleta de acento unico del proyecto. */
.fila.objetivo-voto {
  background: color-mix(in srgb, var(--alert-text) 10%, transparent);
  animation: pulso-objetivo 1.4s var(--ease-out) infinite;
}

@keyframes pulso-objetivo {
  0%,
  100% {
    background-color: color-mix(in srgb, var(--alert-text) 8%, transparent);
  }
  50% {
    background-color: color-mix(in srgb, var(--alert-text) 18%, transparent);
  }
}

/* Entrada/salida de un ocupante (se une o se va/es expulsado) - mismo
   lenguaje visual que mensaje-fade en MessageList.vue. */
.ocupante-fade-enter-active,
.ocupante-fade-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.ocupante-fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.ocupante-fade-leave-to {
  opacity: 0;
  transform: translateX(10px) scale(0.9);
}

.ocupante-fade-leave-active {
  position: absolute;
  width: calc(100% - 1rem);
}

.ocupante-fade-move {
  transition: transform var(--duration-base) var(--ease-out);
}

.avatar {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 600;
  background: var(--bg);
  color: #ffffff;
}

.avatar.propio {
  background: var(--accent-gradient);
  color: var(--accent-contrast);
}

.apodo {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  color: var(--text-h);
}

.sufijo-vos {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.boton-expulsar {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.fila:hover .boton-expulsar,
.boton-expulsar:focus-visible {
  opacity: 1;
}

.boton-expulsar:hover {
  background: color-mix(in srgb, var(--alert-text) 14%, transparent);
  color: var(--alert-text);
}

.boton-expulsar svg {
  width: 1rem;
  height: 1rem;
}
</style>
