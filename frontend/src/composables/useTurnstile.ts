import { ref } from 'vue'

// Apagado por defecto: el proyecto depende del rate limiting y el resto del
// hardening del backend por defecto (ver backend/README.md seccion 9).
// Activable sin tocar codigo con VITE_TURNSTILE_ENABLED=true +
// VITE_TURNSTILE_SITE_KEY (mas TURNSTILE_ENABLED/SECRET_KEY del lado del
// backend, ver backend/.env.example). Generico: usado por fileSharing y
// secretChat por igual (ver components/ui/TurnstileWidget.vue).
export const TURNSTILE_ENABLED = import.meta.env.VITE_TURNSTILE_ENABLED === 'true'
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

interface TurnstileGlobal {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal
  }
}

// Modulo-nivel (no por-instancia): el script de Cloudflare solo debe
// cargarse una vez por pagina, sin importar cuantas veces se monte el
// widget.
let cargaDelScript: Promise<void> | null = null

function cargarScript(): Promise<void> {
  if (cargaDelScript) return cargaDelScript
  cargaDelScript = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Turnstile'))
    document.head.appendChild(script)
  })
  return cargaDelScript
}

export function useTurnstile() {
  const token = ref<string | null>(null)
  const error = ref(false)
  // Id que devuelve render() - lo pide reset() para saber a que instancia
  // del widget aplicarselo (una pagina podria, en teoria, tener mas de una).
  let widgetId: string | null = null

  async function montarEn(contenedor: HTMLElement) {
    try {
      await cargarScript()
      widgetId = window.turnstile!.render(contenedor, {
        sitekey: SITE_KEY,
        callback: (nuevoToken) => {
          token.value = nuevoToken
        },
        'expired-callback': () => {
          token.value = null
        },
        'error-callback': () => {
          error.value = true
        },
      })
    } catch {
      error.value = true
    }
  }

  // Los tokens de Turnstile son de un solo uso - si el submit que lo
  // mandaba fallo del lado del servidor (contraseña incorrecta, sala
  // vencida, lo que sea), el token ya quedo gastado aunque la persona no
  // haya hecho nada mal. Sin este reset, un reintento manda el mismo token
  // vencido y Cloudflare lo rechaza de nuevo sin importar que la persona
  // ahora si tenga la contraseña correcta. Quien llama a esto debe hacerlo
  // solo tras un fallo real de red/servidor, nunca tras un error de
  // validacion puramente local (ver componentes que usan TurnstileWidget).
  function reset() {
    if (widgetId) window.turnstile?.reset(widgetId)
    token.value = null
  }

  return { token, error, montarEn, reset }
}
