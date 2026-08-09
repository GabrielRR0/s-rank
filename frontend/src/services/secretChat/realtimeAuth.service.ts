export interface InitialTokens {
  accessToken: string
  accessExpiresAt: string
  sessionToken: string
  sessionExpiresAt: string
}

export interface RefreshedToken {
  accessToken: string
  accessExpiresAt: string
}

// Se distingue del Error generico para que useRealtimeAuth pueda
// diferenciar "contraseña incorrecta" (401, retryable) de "sala vencida"
// (410, no retryable) o cualquier otro caso - mismo criterio que
// ShareRevealError/VaultError en los otros dominios.
export class RealtimeAuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface InitialTokensApiResponse {
  access_token: string
  access_expires_at: string
  session_token: string
  session_expires_at: string
}

interface RefreshedTokenApiResponse {
  access_token: string
  access_expires_at: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

function parseInitialTokens(body: InitialTokensApiResponse): InitialTokens {
  return {
    accessToken: body.access_token,
    accessExpiresAt: body.access_expires_at,
    sessionToken: body.session_token,
    sessionExpiresAt: body.session_expires_at,
  }
}

export async function createRoomWithPassword(
  roomId: string,
  password: string,
  turnstileToken: string | null,
): Promise<InitialTokens> {
  const response = await fetch(`${API_BASE_URL}/api/secret-chat/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId, password, turnstile_token: turnstileToken }),
  })
  if (!response.ok) {
    throw new RealtimeAuthError(await parseErrorMessage(response, 'No se pudo crear la sala'), response.status)
  }
  return parseInitialTokens(await response.json())
}

export async function fetchInitialTokens(
  roomId: string,
  turnstileToken: string | null,
  password?: string | null,
): Promise<InitialTokens> {
  const response = await fetch(`${API_BASE_URL}/api/secret-chat/realtime-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId, turnstile_token: turnstileToken, password: password ?? null }),
  })
  if (!response.ok) {
    throw new RealtimeAuthError(await parseErrorMessage(response, 'No se pudo conectar a la sala'), response.status)
  }
  return parseInitialTokens(await response.json())
}

export async function refreshAccessToken(roomId: string, sessionToken: string): Promise<RefreshedToken> {
  const response = await fetch(`${API_BASE_URL}/api/secret-chat/realtime-token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId, session_token: sessionToken }),
  })
  if (!response.ok) {
    throw new RealtimeAuthError(await parseErrorMessage(response, 'No se pudo renovar la sesión'), response.status)
  }
  const body: RefreshedTokenApiResponse = await response.json()
  return { accessToken: body.access_token, accessExpiresAt: body.access_expires_at }
}
