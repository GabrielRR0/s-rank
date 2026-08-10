<script setup lang="ts">
import { computed } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import type { VotoExpulsionActivo } from '../../composables/secretChat/useKickVote'

const props = defineProps<{ voto: VotoExpulsionActivo; miClavePresencia: string | null; mayoria: number }>()
const emit = defineEmits<{ votar: [] }>()

const { t } = useLocale()

// No se puede votar si soy el objetivo o si ya vote - mismo chequeo que ya
// hace useKickVote.votar() del lado logico, esto es solo para no mostrar un
// boton que igual no haria nada.
const puedeVotar = computed(
  () => props.miClavePresencia !== props.voto.objetivoClavePresencia && !props.voto.votantes.has(props.miClavePresencia ?? ''),
)
</script>

<template>
  <div class="kick-vote-banner">
    <p class="pregunta">
      {{ t.kickVoteQuestion.replace('{apodo}', voto.objetivoApodo) }}
      <span class="tally">{{ t.kickVoteTally.replace('{votos}', String(voto.votantes.size)).replace('{mayoria}', String(mayoria)) }}</span>
    </p>
    <button v-if="puedeVotar" type="button" class="boton-votar" @click="emit('votar')">
      {{ t.kickVoteButton }}
    </button>
  </div>
</template>

<style scoped>
.kick-vote-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 1.125rem;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-surface));
}

.pregunta {
  min-width: 0;
  font-size: 0.8125rem;
  color: var(--text-h);
}

.tally {
  margin-left: 0.375rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.boton-votar {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-contrast);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.boton-votar:hover {
  opacity: 0.88;
}
</style>
