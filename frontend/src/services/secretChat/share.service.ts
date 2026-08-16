import { copiarAlPortapapeles } from '../../composables/useClipboard'

export type ResultadoCompartir = 'compartido' | 'copiado' | 'cancelado'

// navigator.share (menu nativo del SO) cuando esta disponible; si no, cae al
// portapapeles existente (copiarAlPortapapeles, ya usado por
// ChatSidebar.vue) - mismo resultado final en desktop, menu nativo real en
// mobile.
export async function compartirEnlace(url: string, titulo: string): Promise<ResultadoCompartir> {
  if (navigator.share) {
    try {
      await navigator.share({ url, title: titulo })
      return 'compartido'
    } catch (error) {
      // AbortError: la persona cerro el menu de compartir sin elegir nada -
      // no es un error real, no hay nada que mostrar. Cualquier otro fallo
      // (ej. permisos) cae al portapapeles en vez de dejarla sin ninguna
      // forma de compartir el enlace.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelado'
    }
  }
  const ok = await copiarAlPortapapeles(url)
  return ok ? 'copiado' : 'cancelado'
}
