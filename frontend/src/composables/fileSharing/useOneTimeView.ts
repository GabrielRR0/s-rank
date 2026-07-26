import { onMounted, ref } from 'vue'
import {
  fetchShareStatus,
  revealShare,
  ShareRevealError,
  type RevealedFile,
  type RevealedText,
} from '../../services/fileSharing/sharing.service'

export type EstadoVisor = 'cargando' | 'no-disponible' | 'pide-password' | 'listo-para-ver' | 'revelando' | 'revelado'

export function useOneTimeView(shareId: string) {
  const estado = ref<EstadoVisor>('cargando')
  const requierePassword = ref(false)
  const password = ref('')
  const errorPassword = ref('')
  const contenido = ref<RevealedText | RevealedFile | null>(null)

  async function cargarEstado() {
    try {
      const status = await fetchShareStatus(shareId)
      if (!status.exists) {
        estado.value = 'no-disponible'
        return
      }
      requierePassword.value = status.requiresPassword
      estado.value = status.requiresPassword ? 'pide-password' : 'listo-para-ver'
    } catch {
      estado.value = 'no-disponible'
    }
  }

  // El GET de estado (fetchShareStatus) nunca consume la vista unica - ver
  // backend/app/services/sharedContent/security/README.md. Es seguro
  // dispararlo automaticamente al montar el componente, incluso si un bot
  // de previsualizacion de enlaces llega a ejecutar este mismo codigo.
  onMounted(cargarEstado)

  async function revelar() {
    errorPassword.value = ''
    estado.value = 'revelando'
    try {
      contenido.value = await revealShare(shareId, requierePassword.value ? password.value : null)
      estado.value = 'revelado'
    } catch (error) {
      if (error instanceof ShareRevealError && error.status === 401) {
        // Contraseña incorrecta: la vista unica todavia no se consumio
        // (ver backend), asi que se deja reintentar en el mismo formulario.
        errorPassword.value = error.message
        estado.value = 'pide-password'
      } else {
        // Vencido, ya visto, o cualquier otro error: no hay nada que
        // reintentar, se muestra la pantalla final de enlace no disponible.
        estado.value = 'no-disponible'
      }
    }
  }

  return { estado, requierePassword, password, errorPassword, contenido, revelar }
}
