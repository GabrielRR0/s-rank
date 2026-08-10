<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { TURNSTILE_ENABLED } from '../../composables/useTurnstile'
import { useRoomAuthChallenge } from '../../composables/secretChat/useRoomAuthChallenge'
import { validateNicknameInput } from '../../utils/validators/validateChatInput'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseButton from '../ui/BaseButton.vue'
import TurnstileWidget from '../ui/TurnstileWidget.vue'

const props = defineProps<{ roomId: string; requierePassword: boolean }>()
const emit = defineEmits<{ confirmar: [apodo: string] }>()

const { t } = useLocale()
const apodo = ref('')
const erroresApodo = ref<string[]>([])
const { turnstileToken, password, enviando, error: errorChallenge, verificar } = useRoomAuthChallenge(props.roomId)

async function confirmar() {
  erroresApodo.value = validateNicknameInput(apodo.value, t.value.errorNicknameRequired, t.value.errorNicknameTooLong)
  if (erroresApodo.value.length) return

  const ok = await verificar()
  if (ok) emit('confirmar', apodo.value.trim())
}
</script>

<template>
  <form class="nickname-entry" @submit.prevent="confirmar">
    <h2>{{ t.nicknameJoinHeading }}</h2>
    <p class="subtitulo">{{ t.nicknameJoinSubtitle }}</p>
    <input v-model="apodo" type="text" class="campo-input" :placeholder="t.nicknamePlaceholder" maxlength="24" />

    <input
      v-if="requierePassword"
      v-model="password"
      type="password"
      class="campo-input"
      :placeholder="t.roomPasswordPlaceholder"
      autocomplete="current-password"
    />

    <TurnstileWidget v-if="TURNSTILE_ENABLED" @token="turnstileToken = $event" />

    <BaseAlert :mensajes="erroresApodo.length ? erroresApodo : errorChallenge ? [errorChallenge] : []" />

    <BaseButton :disabled="enviando" @click="confirmar">
      {{ enviando ? t.reverifyingButton : t.nicknameJoinButton }}
    </BaseButton>
  </form>
</template>

<style scoped>
.nickname-entry {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  animation: fade-in-up var(--duration-base) var(--ease-out) both;
}

.subtitulo {
  color: var(--text-muted);
  font-size: 0.9375rem;
}

.campo-input {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-h);
  font: inherit;
  font-size: 0.9375rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.campo-input:focus {
  outline: none;
  border-color: var(--accent);
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
