import { computed, ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
  interface Navigator {
    // No estandar, solo iOS Safari - true cuando la pagina ya corre como
    // app instalada desde la pantalla de inicio.
    standalone?: boolean
  }
}

function yaInstalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

// iOS no tiene beforeinstallprompt ni ninguna API de instalacion - lo unico
// posible ahi es explicarle a la persona el paso manual (Compartir > Agregar
// a inicio), ver NotifyInstallBanner.vue.
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window)

// Singleton a nivel de modulo, con el listener puesto AL IMPORTAR (no
// adentro de useInstallPrompt()): el navegador dispara beforeinstallprompt
// una sola vez por carga de pagina, en cualquier momento tras evaluar los
// criterios de instalabilidad - si el listener no esta puesto para
// entonces, el evento se pierde para siempre (no hay forma de volver a
// pedirlo). Por eso App.vue importa/llama este modulo al arrancar, igual
// que ya hace con apodoActual de useRoomNickname.ts.
export const eventoDiferido = ref<BeforeInstallPromptEvent | null>(null)
export const instalada = ref(yaInstalada())

window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault()
  eventoDiferido.value = evento
})
window.addEventListener('appinstalled', () => {
  instalada.value = true
  eventoDiferido.value = null
})

export function useInstallPrompt() {
  const disponible = computed(() => eventoDiferido.value !== null)

  async function instalar() {
    if (!eventoDiferido.value) return
    await eventoDiferido.value.prompt()
    const eleccion = await eventoDiferido.value.userChoice
    if (eleccion.outcome === 'accepted') instalada.value = true
    eventoDiferido.value = null
  }

  return { disponible, instalada, esIOS, instalar }
}
