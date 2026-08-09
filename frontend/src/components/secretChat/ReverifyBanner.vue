<script setup lang="ts">
import { useLocale } from '../../i18n/useLocale'
import { useRoomAuthChallenge } from '../../composables/secretChat/useRoomAuthChallenge'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseButton from '../ui/BaseButton.vue'
import TurnstileWidget from '../ui/TurnstileWidget.vue'
import { TURNSTILE_ENABLED } from '../../composables/useTurnstile'

const props = defineProps<{ roomId: string; requierePassword: boolean }>()
const emit = defineEmits<{ verificado: [] }>()

const { t } = useLocale()
const { turnstileToken, password, enviando, error, verificar } = useRoomAuthChallenge(props.roomId)

async function manejarSubmit() {
  const ok = await verificar()
  if (ok) emit('verificado')
}
</script>

<template>
  <div class="reverify-banner">
    <p class="titulo">{{ t.reverifyHeading }}</p>

    <form class="formulario" @submit.prevent="manejarSubmit">
      <input
        v-if="requierePassword"
        v-model="password"
        type="password"
        class="campo-password"
        :placeholder="t.roomPasswordPlaceholder"
        autocomplete="current-password"
      />
      <TurnstileWidget v-if="TURNSTILE_ENABLED" @token="turnstileToken = $event" />

      <BaseAlert :mensajes="error ? [error] : []" />

      <BaseButton :disabled="enviando" @click="manejarSubmit">
        {{ enviando ? t.reverifyingButton : t.reverifyButton }}
      </BaseButton>
    </form>
  </div>
</template>

<style scoped>
.reverify-banner {
  padding: 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.titulo {
  font-size: 0.9375rem;
  color: var(--text-h);
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.campo-password {
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-h);
  font: inherit;
  font-size: 0.9375rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-password:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
