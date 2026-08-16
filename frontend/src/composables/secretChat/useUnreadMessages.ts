import { ref } from 'vue'

// Badge API - no esta en lib.dom.d.ts todavia, mismo motivo que
// `standalone` en useInstallPrompt.ts (API nueva, no estandar en TS aun).
declare global {
  interface Navigator {
    setAppBadge?(contents?: number): Promise<void>
    clearAppBadge?(): Promise<void>
  }
}

// Una instancia por conexion a sala (como useSecretChatRoom), no singleton -
// el contador de no vistos es propio de CADA sala, no del origen entero.
// Alimenta dos cosas con el mismo numero: el pill "N mensajes nuevos" dentro
// de MessageList.vue, y el Badge API del icono de la app instalada (ver
// useInstallPrompt.ts) - sin duplicar el conteo en dos lugares.
export function useUnreadMessages() {
  const noVistos = ref(0)

  function sincronizarBadge() {
    if (!navigator.setAppBadge) return
    if (noVistos.value > 0) {
      void navigator.setAppBadge(noVistos.value)
    } else {
      void navigator.clearAppBadge?.()
    }
  }

  function marcarNoVisto() {
    noVistos.value++
    sincronizarBadge()
  }

  function marcarTodoVisto() {
    if (noVistos.value === 0) return
    noVistos.value = 0
    sincronizarBadge()
  }

  return { noVistos, marcarNoVisto, marcarTodoVisto }
}
