import { ref } from 'vue'

// navigator.clipboard.writeText() puede quedar colgado (no resolver NI
// rechazar) si la pestaña perdio el foco o el permiso quedo en un estado
// raro - sin este limite, copiar() se quedaria esperando para siempre. 2s
// alcanza de sobra para una escritura al portapapeles normal. Extraido de
// useVaultItem.ts (que ya lo resolvia asi) para que ChatSidebar.vue no
// duplique una tercera version de este mismo problema - ver
// ChatCreateResult.vue/ShareResult.vue para las otras dos, sin este guard,
// que quedan sin tocar por ahora.
const TIMEOUT_PORTAPAPELES_MS = 2000
const DURACION_COPIADO_MS = 2000

export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
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

export function useClipboard() {
  const copiado = ref(false)

  async function copiar(texto: string): Promise<boolean> {
    const ok = await copiarAlPortapapeles(texto)
    if (ok) {
      copiado.value = true
      setTimeout(() => {
        copiado.value = false
      }, DURACION_COPIADO_MS)
    }
    return ok
  }

  return { copiado, copiar }
}
