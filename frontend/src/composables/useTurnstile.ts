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

  async function montarEn(contenedor: HTMLElement) {
    try {
      await cargarScript()
      window.turnstile!.render(contenedor, {
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

  return { token, error, montarEn }
}
