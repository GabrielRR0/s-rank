import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { createFileShare, createTextShare, type CreateShareResult } from '../../services/fileSharing/sharing.service'
import { validateFileInput, validateTextInput } from '../../utils/validators/validateShareInput'

// Minutos - mismo set que ALLOWED_EXPIRATIONS_MINUTES en el backend
// (backend/app/schemas/sharedContent/shared_content_schemas.py). Duplicado a
// proposito (igual que las traducciones): el backend es quien realmente
// valida, esto solo arma las opciones de ExpirationSelector.vue.
export const EXPIRATION_OPTIONS_MINUTES = [10, 60, 60 * 24, 60 * 24 * 3, 60 * 24 * 7] as const

export function useUpload() {
  const { t } = useLocale()

  const modo = ref<'text' | 'file'>('text')
  const texto = ref('')
  const archivo = ref<File | null>(null)
  const password = ref('')
  const protegerConPassword = ref(false)
  const expiracionMinutos = ref<number>(60)

  const errores = ref<string[]>([])
  const creando = ref(false)
  const resultado = ref<CreateShareResult | null>(null)
  const errorCreacion = ref('')

  function elegirArchivo(nuevo: File | null) {
    archivo.value = nuevo
    errores.value = []
  }

  function validar(): boolean {
    errores.value =
      modo.value === 'text'
        ? validateTextInput(texto.value, t.value.errorTextRequired)
        : validateFileInput(archivo.value, t.value.errorFileRequired, t.value.errorFileTooLarge)
    return errores.value.length === 0
  }

  async function crear() {
    errorCreacion.value = ''
    if (!validar()) return

    creando.value = true
    try {
      // Contraseña solo se manda si el toggle esta activo Y tiene texto -
      // activar el toggle y dejar el campo vacio equivale a no proteger el
      // share (evita mandar una contraseña vacia que despues nadie puede
      // "adivinar" para pasar la verificacion).
      const passwordAEnviar = protegerConPassword.value && password.value ? password.value : null
      resultado.value =
        modo.value === 'text'
          ? await createTextShare(texto.value, passwordAEnviar, expiracionMinutos.value)
          : await createFileShare(archivo.value!, passwordAEnviar, expiracionMinutos.value)
    } catch (error) {
      errorCreacion.value = error instanceof Error ? error.message : 'Error'
    } finally {
      creando.value = false
    }
  }

  function reiniciar() {
    modo.value = 'text'
    texto.value = ''
    archivo.value = null
    password.value = ''
    protegerConPassword.value = false
    expiracionMinutos.value = 60
    errores.value = []
    resultado.value = null
    errorCreacion.value = ''
  }

  return {
    modo,
    texto,
    archivo,
    password,
    protegerConPassword,
    expiracionMinutos,
    errores,
    creando,
    resultado,
    errorCreacion,
    elegirArchivo,
    crear,
    reiniciar,
  }
}
