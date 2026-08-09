import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { fetchInitialTokens, RealtimeAuthError } from '../../services/secretChat/realtimeAuth.service'
import { guardarSesion } from './useRoomSession'

// Compartido por NicknameEntry.vue (primera entrada a la sala) y
// ReverifyBanner.vue (cuando la sesion vencio a mitad de conversacion) -
// en los dos casos el paso es identico: resolver Turnstile (+ contraseña
// si la sala la tiene), pedir el par de tokens, y guardar el session_token
// para que useRealtimeAuth.ts lo use de ahi en adelante.
export function useRoomAuthChallenge(roomId: string) {
  const { t } = useLocale()
  const turnstileToken = ref<string | null>(null)
  const password = ref('')
  const enviando = ref(false)
  const error = ref('')

  async function verificar(): Promise<boolean> {
    error.value = ''
    enviando.value = true
    try {
      const tokens = await fetchInitialTokens(roomId, turnstileToken.value, password.value || null)
      guardarSesion(roomId, tokens.sessionToken, tokens.sessionExpiresAt)
      return true
    } catch (err) {
      if (err instanceof RealtimeAuthError && err.status === 401) {
        error.value = t.value.errorRoomPasswordIncorrect
      } else if (err instanceof RealtimeAuthError && err.status === 410) {
        error.value = t.value.errorRoomExpired
      } else if (err instanceof RealtimeAuthError && err.status === 429) {
        error.value = t.value.errorRoomTooManyAttempts
      } else {
        error.value = t.value.errorRoomVerificationFailed
      }
      return false
    } finally {
      enviando.value = false
    }
  }

  return { turnstileToken, password, enviando, error, verificar }
}
