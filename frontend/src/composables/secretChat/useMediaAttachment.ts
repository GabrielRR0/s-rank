import { ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'

export interface ArchivoSeleccionado {
  datos: ArrayBuffer
  mimeType: string
}

// Techo solo de UX (feedback inmediato sin esperar la subida) - el backend
// es la fuente de verdad real (chat_media_max_bytes/vault_media_max_bytes,
// ver backend/app/config.py), nunca se confia en este chequeo solo.
const MAX_ATTACHMENT_BYTES = 10_000_000

export function useMediaAttachment() {
  const { t } = useLocale()
  const archivoSeleccionado = ref<ArchivoSeleccionado | null>(null)
  const error = ref('')

  async function seleccionarArchivo(event: Event) {
    error.value = ''
    const input = event.target as HTMLInputElement
    const archivo = input.files?.[0]
    // Permite volver a elegir el mismo archivo despues de cancelar/enviar -
    // sin esto, el evento 'change' no se dispara una segunda vez si el
    // usuario selecciona el mismo path otra vez.
    input.value = ''
    if (!archivo) return

    if (!archivo.type.startsWith('image/')) {
      error.value = t.value.errorAttachmentNotImage
      return
    }
    if (archivo.size > MAX_ATTACHMENT_BYTES) {
      error.value = t.value.errorAttachmentTooLarge
      return
    }
    archivoSeleccionado.value = { datos: await archivo.arrayBuffer(), mimeType: archivo.type }
  }

  function limpiar() {
    archivoSeleccionado.value = null
    error.value = ''
  }

  return { archivoSeleccionado, error, seleccionarArchivo, limpiar }
}
