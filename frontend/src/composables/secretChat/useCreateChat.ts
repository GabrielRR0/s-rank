import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { exportarClaveParaUrl, generarClaveSala } from '../../services/secretChat/crypto.service'
import { createRoomWithPassword, fetchInitialTokens, RealtimeAuthError } from '../../services/secretChat/realtimeAuth.service'
import { validateNicknameInput, validateVaultSecretInput } from '../../utils/validators/validateChatInput'
import { NICKNAME_STORAGE_KEY_PREFIX, recordarApodoActual } from './useRoomNickname'
import { guardarSesion } from './useRoomSession'

export const CAPACIDAD_OPCIONES = [2, 3, 4, 5, 6] as const
export const TTL_OPCIONES_SEGUNDOS = [5, 10, 15, 30, 60] as const

export interface CreateChatResult {
  roomId: string
  enlace: string
}

export function useCreateChat() {
  const { t } = useLocale()

  const apodo = ref('')
  const capacidadMaxima = ref<number>(4)
  const ttlSegundos = ref<number>(15)
  const protegerConPassword = ref(false)
  const password = ref('')
  const turnstileToken = ref<string | null>(null)
  const errores = ref<string[]>([])
  const creando = ref(false)
  const resultado = ref<CreateChatResult | null>(null)

  function validar(): boolean {
    errores.value = validateNicknameInput(apodo.value, t.value.errorNicknameRequired, t.value.errorNicknameTooLong)
    if (errores.value.length) return false
    if (protegerConPassword.value) {
      // Reutiliza el mismo validador de largo que el Cofre - una
      // contraseña de sala es texto corto, mismo criterio de higiene.
      errores.value = validateVaultSecretInput(
        password.value,
        t.value.errorRoomPasswordRequired,
        t.value.errorVaultSecretTooLong,
      )
    }
    return errores.value.length === 0
  }

  async function crear() {
    if (!validar()) return
    creando.value = true
    try {
      const roomId = crypto.randomUUID()
      const clave = await generarClaveSala()
      const claveUrl = await exportarClaveParaUrl(clave)
      const pwdFlag = protegerConPassword.value ? '&pwd=1' : ''
      const enlace = `${window.location.origin}/chat/${roomId}?cap=${capacidadMaxima.value}&ttl=${ttlSegundos.value}${pwdFlag}#${claveUrl}`

      const tokens = protegerConPassword.value
        ? await createRoomWithPassword(roomId, password.value, turnstileToken.value)
        : await fetchInitialTokens(roomId, turnstileToken.value)
      // Se guarda de una vez asi, al tocar "Entrar ahora", ChatRoomMain no
      // vuelve a pedir Turnstile - el creador ya lo resolvio para crear la
      // sala (ver useRoomSession.ts).
      guardarSesion(roomId, tokens.sessionToken, tokens.sessionExpiresAt)

      // El creador ya eligio su apodo aca - se guarda para esta sala especifica
      // asi que, al entrar a su propio enlace, ChatRoomMain no vuelve a
      // pedirselo (mismo storage que lee useRoomNickname.ts al unirse).
      sessionStorage.setItem(`${NICKNAME_STORAGE_KEY_PREFIX}${roomId}`, apodo.value)
      recordarApodoActual(apodo.value)

      resultado.value = { roomId, enlace }
    } catch (error) {
      errores.value = [error instanceof RealtimeAuthError ? error.message : t.value.errorRoomVerificationFailed]
    } finally {
      creando.value = false
    }
  }

  function reiniciar() {
    apodo.value = ''
    capacidadMaxima.value = 4
    ttlSegundos.value = 15
    protegerConPassword.value = false
    password.value = ''
    turnstileToken.value = null
    errores.value = []
    resultado.value = null
  }

  return {
    apodo,
    capacidadMaxima,
    ttlSegundos,
    protegerConPassword,
    password,
    turnstileToken,
    errores,
    creando,
    resultado,
    crear,
    reiniciar,
  }
}
