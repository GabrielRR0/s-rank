// Funciones planas (no un composable) a proposito: se necesitan tanto desde
// un composable con ciclo de vida (useRealtimeAuth.ts) como desde un
// computed sincrono en ChatRoomMain.vue para decidir si hace falta mostrar
// NicknameEntry.vue - no tiene sentido instanciar un composable solo para
// leer sessionStorage una vez.
export const SESSION_STORAGE_KEY_PREFIX = 's-rank-chat:session:'
// Aparte de SESSION_STORAGE_KEY_PREFIX: limpiar la sesion sola alcanzaria
// para volver a pedir Turnstile/contraseña, pero no para bloquear el
// reingreso - quien fue expulsado podria simplemente resolverlos de nuevo.
// Esta marca es la que realmente impide reentrar, ni con un refresh de
// pagina (ver useKickVote.ts/ChatRoomMain.vue).
const KICKED_STORAGE_KEY_PREFIX = 's-rank-chat:kicked:'

interface SesionGuardada {
  sessionToken: string
  sessionExpiresAt: string
}

function claveStorage(roomId: string): string {
  return `${SESSION_STORAGE_KEY_PREFIX}${roomId}`
}

function leerSesion(roomId: string): SesionGuardada | null {
  const crudo = sessionStorage.getItem(claveStorage(roomId))
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as SesionGuardada
  } catch {
    return null
  }
}

export function hasValidSession(roomId: string): boolean {
  const sesion = leerSesion(roomId)
  return sesion !== null && new Date(sesion.sessionExpiresAt).getTime() > Date.now()
}

export function obtenerSessionToken(roomId: string): string | null {
  if (!hasValidSession(roomId)) return null
  return leerSesion(roomId)!.sessionToken
}

export function guardarSesion(roomId: string, sessionToken: string, sessionExpiresAt: string): void {
  sessionStorage.setItem(claveStorage(roomId), JSON.stringify({ sessionToken, sessionExpiresAt }))
}

export function limpiarSesion(roomId: string): void {
  sessionStorage.removeItem(claveStorage(roomId))
}

export function marcarExpulsado(roomId: string): void {
  sessionStorage.setItem(`${KICKED_STORAGE_KEY_PREFIX}${roomId}`, '1')
}

export function fueExpulsado(roomId: string): boolean {
  return sessionStorage.getItem(`${KICKED_STORAGE_KEY_PREFIX}${roomId}`) === '1'
}
