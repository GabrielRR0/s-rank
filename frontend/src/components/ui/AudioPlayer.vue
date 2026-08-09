<script setup lang="ts">
import { computed } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { useAudioPlayer } from '../../composables/useAudioPlayer'

const props = defineProps<{ datos: ArrayBuffer }>()
const { t } = useLocale()
const { reproduciendo, posicionSegundos, duracionSegundos, error, alternar, buscar } = useAudioPlayer(props.datos)

function formatear(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos))
  const minutos = Math.floor(total / 60)
  const restoSegundos = total % 60
  return `${minutos}:${restoSegundos.toString().padStart(2, '0')}`
}

const posicionFormateada = computed(() => formatear(posicionSegundos.value))
const duracionFormateada = computed(() => formatear(duracionSegundos.value))
const progresoPorcentaje = computed(() =>
  duracionSegundos.value > 0 ? (posicionSegundos.value / duracionSegundos.value) * 100 : 0,
)

function manejarBuscar(event: Event) {
  buscar(Number((event.target as HTMLInputElement).value) / 100)
}
</script>

<template>
  <!-- Sin <audio src="...">: nunca hay una URL de archivo en el DOM que un
       click derecho pueda ofrecer descargar (ver useAudioPlayer.ts). -->
  <div class="audio-player" @contextmenu.prevent>
    <button
      type="button"
      class="boton-play"
      :aria-label="reproduciendo ? t.audioPlayerPauseAria : t.audioPlayerPlayAria"
      :title="reproduciendo ? t.audioPlayerPauseAria : t.audioPlayerPlayAria"
      :disabled="error"
      @click="alternar"
    >
      <svg v-if="!reproduciendo" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M6 4.5a1 1 0 011.5-.87l9 5.5a1 1 0 010 1.74l-9 5.5A1 1 0 016 15.5v-11z" />
      </svg>
      <svg v-else viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M6 4a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4zm5 0a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1h-1a1 1 0 01-1-1V4z"
        />
      </svg>
    </button>

    <input
      type="range"
      class="barra"
      min="0"
      max="100"
      step="0.1"
      :value="progresoPorcentaje"
      :disabled="error"
      @input="manejarBuscar"
    />

    <span class="tiempo">{{ posicionFormateada }} / {{ duracionFormateada }}</span>
  </div>
</template>

<style scoped>
.audio-player {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--text) 6%, transparent);
  max-width: 16rem;
}

.boton-play {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast);
  cursor: pointer;
}

.boton-play:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.boton-play svg {
  width: 0.875rem;
  height: 0.875rem;
}

.barra {
  flex: 1;
  accent-color: var(--accent);
}

.tiempo {
  flex-shrink: 0;
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
