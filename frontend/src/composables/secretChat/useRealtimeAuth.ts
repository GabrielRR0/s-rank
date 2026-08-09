import { onUnmounted, ref } from 'vue'
import { setRealtimeAuth } from '../../services/secretChat/realtime.service'
import { RealtimeAuthError, refreshAccessToken } from '../../services/secretChat/realtimeAuth.service'
import { limpiarSesion, obtenerSessionToken } from './useRoomSession'

export type EstadoAuth = 'pendiente' | 'listo' | 'requiere-reverificacion'

// Margen antes del vencimiento real del access token para refrescarlo -
// evita quedar sin autorizacion valida por una diferencia de reloj o
// latencia del request de refresco.
const MARGEN_REFRESCO_MS = 60_000
const REINTENTO_MS = 15_000

// No hay Turnstile aca a proposito: ese paso ya paso (en NicknameEntry.vue
// o al crear la sala, ver useRoomAuthChallenge.ts) - este composable solo
// consume el session_token que ya quedo guardado en sessionStorage
// (useRoomSession.ts) para mantener el access_token de Realtime vigente
// mientras dura la conexion, sin volver a mostrar un captcha cada pocos
// minutos.
export function useRealtimeAuth(roomId: string) {
  const estado = ref<EstadoAuth>('pendiente')
  let timer: ReturnType<typeof setTimeout> | undefined

  function programarProximoRefresco(accessExpiresAt: string) {
    const delayMs = Math.max(new Date(accessExpiresAt).getTime() - Date.now() - MARGEN_REFRESCO_MS, 5_000)
    timer = setTimeout(refrescar, delayMs)
  }

  async function refrescar(): Promise<void> {
    const sessionToken = obtenerSessionToken(roomId)
    if (!sessionToken) {
      estado.value = 'requiere-reverificacion'
      return
    }

    try {
      const { accessToken, accessExpiresAt } = await refreshAccessToken(roomId, sessionToken)
      await setRealtimeAuth(accessToken)
      estado.value = 'listo'
      programarProximoRefresco(accessExpiresAt)
    } catch (error) {
      if (error instanceof RealtimeAuthError && error.status === 401) {
        // session_token invalido o vencido - no hay nada que reintentar
        // solo, hace falta que la persona resuelva Turnstile de nuevo
        // (ver ReverifyBanner.vue).
        limpiarSesion(roomId)
        estado.value = 'requiere-reverificacion'
      } else {
        // Fallo de red puntual: la autorizacion ya cacheada en el socket
        // abierto sigue funcionando un rato (Supabase no la re-evalua por
        // mensaje, ver backend/README.md seccion 14) - reintenta con
        // backoff corto en vez de cortar la sala de una.
        timer = setTimeout(refrescar, REINTENTO_MS)
      }
    }
  }

  // Reutilizable tanto para la conexion inicial como para reintentar
  // despues de resolver Turnstile de nuevo en ReverifyBanner.vue - ambos
  // casos son "hay (o debería haber) un session_token vigente, aplicalo".
  async function iniciar(): Promise<void> {
    await refrescar()
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return { estado, iniciar }
}
