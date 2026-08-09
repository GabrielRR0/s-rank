import { onUnmounted, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { base64UrlABytes, descifrarBinario, descifrarTexto } from '../../services/secretChat/crypto.service'
import { copyVaultItem, fetchVaultItem, VaultError } from '../../services/secretChat/vault.service'

export type EstadoVaultItem = 'cargando' | 'disponible' | 'agotado'

// navigator.clipboard.writeText() puede quedar colgado (no resolver NI
// rechazar) si la pestaña perdio el foco o el permiso quedo en un estado
// raro - sin este limite, copiar() se quedaria esperando para siempre. 2s
// alcanza de sobra para una escritura al portapapeles normal.
const TIMEOUT_PORTAPAPELES_MS = 2000

async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await Promise.race([
      navigator.clipboard.writeText(texto),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_PORTAPAPELES_MS)),
    ])
    return true
  } catch {
    return false
  }
}

// Content-only: la fuente de verdad de "cuantas copias quedan" para TODOS
// los participantes es el array `vaults` de useSecretChatRoom (actualizado
// via broadcast) - este composable solo trae/descifra el contenido una vez
// y ejecuta la accion de copiar, avisando hacia arriba el nuevo contador
// que devolvio el backend (autoritativo, ver backend/README.md seccion 12).
export function useVaultItem(vaultId: string, clave: CryptoKey) {
  const { t } = useLocale()
  const estado = ref<EstadoVaultItem>('cargando')
  const contentType = ref<'text' | 'image' | 'audio'>('text')
  const mimeType = ref<string | null>(null)
  const valorDescifrado = ref('')
  const valorDescifradoUrl = ref<string | null>(null)
  // Solo audio - AudioPlayer.vue decodifica el ArrayBuffer crudo con la Web
  // Audio API, sin pasar por un <audio src> nativo (ver secretChat/README.md).
  const valorDescifradoDatos = ref<ArrayBuffer | null>(null)
  const revelado = ref(false)
  const copiando = ref(false)
  const errorCopia = ref('')

  async function cargar() {
    try {
      const item = await fetchVaultItem(vaultId)
      contentType.value = item.contentType
      mimeType.value = item.mimeType
      if (item.contentType === 'text') {
        valorDescifrado.value = await descifrarTexto(clave, { ciphertext: item.ciphertext!, nonce: item.nonce })
      } else {
        // Ver el item no esta limitado (solo copiarlo lo esta, igual que el
        // texto) - se descifra ya aca, no recien al "Ver"/"Reproducir", que
        // es cuando de verdad se gasta una copia (ver copiar() mas abajo).
        const datos = await descifrarBinario(clave, {
          ciphertext: base64UrlABytes(item.ciphertext!),
          nonce: item.nonce,
        })
        if (item.contentType === 'audio') {
          valorDescifradoDatos.value = datos
        } else {
          valorDescifradoUrl.value = URL.createObjectURL(new Blob([datos], { type: item.mimeType! }))
        }
      }
      estado.value = 'disponible'
    } catch {
      estado.value = 'agotado'
    }
  }

  cargar()

  function alternarRevelado() {
    revelado.value = !revelado.value
  }

  async function copiar(): Promise<number | null> {
    errorCopia.value = ''
    copiando.value = true
    try {
      // El consumo de la copia es lo que importa para el contador
      // compartido de la sala (ver useSecretChatRoom.notificarCopiaVault) -
      // ya paso del lado del servidor y es irreversible, asi que NO puede
      // quedar condicionado a que el portapapeles tambien funcione.
      const item = await copyVaultItem(vaultId)
      if (item.remainingCopies <= 0) estado.value = 'agotado'

      if (contentType.value === 'text') {
        const copiadoOk = await copiarAlPortapapeles(valorDescifrado.value)
        if (!copiadoOk) {
          // La copia ya se gasto igual - mostrar el valor para que se pueda
          // copiar a mano es mejor que dejar a la persona sin nada.
          revelado.value = true
          errorCopia.value = t.value.errorVaultClipboardFailed
        }
      } else {
        // "Copiar" una imagen/audio no tiene el mismo sentido que un texto -
        // el boton (relabeleado "Ver"/"Reproducir" en VaultCard.vue) revela
        // el contenido ya descifrado en cargar(), sin tocar el portapapeles.
        revelado.value = true
      }

      return item.remainingCopies
    } catch (error) {
      if (error instanceof VaultError && error.status === 410) {
        estado.value = 'agotado'
      } else {
        errorCopia.value = t.value.errorVaultCopyFailed
      }
      return null
    } finally {
      copiando.value = false
    }
  }

  onUnmounted(() => {
    if (valorDescifradoUrl.value) URL.revokeObjectURL(valorDescifradoUrl.value)
  })

  return {
    estado,
    contentType,
    mimeType,
    valorDescifrado,
    valorDescifradoUrl,
    valorDescifradoDatos,
    revelado,
    copiando,
    errorCopia,
    alternarRevelado,
    copiar,
  }
}
