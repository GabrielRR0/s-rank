import { ref } from 'vue'
import { importarClaveDesdeUrl } from '../../services/secretChat/crypto.service'

// Lee la clave de cifrado del fragmento de la URL (#hash) - nunca del path
// ni de un query param, porque el fragmento es lo unico que el navegador
// jamas envia en un request HTTP (ni siquiera a este mismo backend). Ver
// services/secretChat/crypto.service.ts y README.md de este dominio.
export function useRoomKey() {
  const clave = ref<CryptoKey | null>(null)
  const cargando = ref(true)
  const error = ref(false)

  async function cargar() {
    const fragmento = window.location.hash.slice(1)
    if (!fragmento) {
      error.value = true
      cargando.value = false
      return
    }
    try {
      clave.value = await importarClaveDesdeUrl(fragmento)
    } catch {
      error.value = true
    } finally {
      cargando.value = false
    }
  }

  cargar()

  return { clave, cargando, error }
}
