import { onUnmounted, ref } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { base64UrlABytes, descifrarBinario, descifrarTexto } from '../../services/secretChat/crypto.service'
import { copyVaultItem, fetchVaultItem, VaultError } from '../../services/secretChat/vault.service'

export type EstadoVaultItem = 'cargando' | 'disponible' | 'agotado'

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
  const revelando = ref(false)
  const errorRevelar = ref('')

  async function cargar() {
    try {
      const item = await fetchVaultItem(vaultId)
      contentType.value = item.contentType
      mimeType.value = item.mimeType
      if (item.contentType === 'text') {
        valorDescifrado.value = await descifrarTexto(clave, { ciphertext: item.ciphertext!, nonce: item.nonce })
      } else {
        // Ver el item no esta limitado (solo revelarlo lo esta, igual que el
        // texto) - se descifra ya aca, no recien al "Mostrar"/"Reproducir",
        // que es cuando de verdad se gasta una copia (ver revelar() abajo).
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

  // Unica accion posible: mostrar el contenido SIEMPRE gasta una copia, para
  // texto igual que para imagen/audio - no hay portapapeles ni un toggle
  // gratuito de mostrar/ocultar, ver el valor de la capsula es en si mismo
  // el consumo (ver VaultCard.vue).
  async function revelar(): Promise<number | null> {
    errorRevelar.value = ''
    revelando.value = true
    try {
      // El consumo de la copia es lo que importa para el contador
      // compartido de la sala (ver useSecretChatRoom.notificarCopiaVault) -
      // ya paso del lado del servidor y es irreversible.
      const item = await copyVaultItem(vaultId)
      if (item.remainingCopies <= 0) estado.value = 'agotado'
      revelado.value = true
      return item.remainingCopies
    } catch (error) {
      if (error instanceof VaultError && error.status === 410) {
        estado.value = 'agotado'
      } else {
        errorRevelar.value = t.value.errorVaultRevealFailed
      }
      return null
    } finally {
      revelando.value = false
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
    revelando,
    errorRevelar,
    revelar,
  }
}
