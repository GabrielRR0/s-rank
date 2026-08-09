export interface VaultItem {
  id: string
  // null solo puede pasar en la respuesta de copyVaultItem() para un item
  // de imagen/audio (esa ruta no vuelve a leer Storage, ver
  // secret_vault_service.consume_copy) - fetchVaultItem() siempre lo
  // rellena. useVaultItem.ts nunca lee este campo de la respuesta de
  // copiar(), solo de la de cargar().
  ciphertext: string | null
  nonce: string
  maxCopies: number
  remainingCopies: number
  expiresAt: string
  contentType: 'text' | 'image' | 'audio'
  mimeType: string | null
}

// Se distingue del Error generico para que useVaultItem pueda diferenciar
// "agotado/expirado" (410, ya no hay nada que hacer) de un error de red -
// mismo criterio que ShareRevealError en sharing.service.ts.
export class VaultError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface VaultItemApiResponse {
  id: string
  ciphertext: string | null
  nonce: string
  max_copies: number
  remaining_copies: number
  expires_at: string
  content_type: 'text' | 'image' | 'audio'
  mime_type: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

function parseVaultItem(body: VaultItemApiResponse): VaultItem {
  return {
    id: body.id,
    ciphertext: body.ciphertext,
    nonce: body.nonce,
    maxCopies: body.max_copies,
    remainingCopies: body.remaining_copies,
    expiresAt: body.expires_at,
    contentType: body.content_type,
    mimeType: body.mime_type,
  }
}

interface CreateVaultItemParams {
  ciphertext: string
  nonce: string
  maxCopies: number
  ttlSeconds: number
  roomId?: string | null
}

export async function createVaultItem(params: CreateVaultItemParams): Promise<{ id: string; expiresAt: string }> {
  const response = await fetch(`${API_BASE_URL}/api/secret-vault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ciphertext: params.ciphertext,
      nonce: params.nonce,
      max_copies: params.maxCopies,
      ttl_seconds: params.ttlSeconds,
      room_id: params.roomId ?? null,
    }),
  })
  if (!response.ok) {
    throw new VaultError(await parseErrorMessage(response, 'No se pudo crear el item del cofre'), response.status)
  }
  const body = await response.json()
  return { id: body.id, expiresAt: body.expires_at }
}

interface CreateVaultMediaItemParams {
  contentType: 'image' | 'audio'
  mimeType: string
  maxCopies: number
  ttlSeconds: number
  nonce: string
  ciphertext: Uint8Array<ArrayBuffer>
  roomId?: string | null
}

// multipart/form-data (no JSON), ruta separada de createVaultItem - mismo
// motivo que uploadChatMedia: FastAPI no permite mezclar un body JSON con
// UploadFile en el mismo endpoint.
export async function createVaultMediaItem(params: CreateVaultMediaItemParams): Promise<{ id: string; expiresAt: string }> {
  const formData = new FormData()
  formData.append('content_type', params.contentType)
  formData.append('mime_type', params.mimeType)
  formData.append('max_copies', String(params.maxCopies))
  formData.append('ttl_seconds', String(params.ttlSeconds))
  formData.append('nonce', params.nonce)
  if (params.roomId) formData.append('room_id', params.roomId)
  formData.append('ciphertext_file', new Blob([params.ciphertext]), 'ciphertext.bin')

  const response = await fetch(`${API_BASE_URL}/api/secret-vault/media`, { method: 'POST', body: formData })
  if (!response.ok) {
    throw new VaultError(await parseErrorMessage(response, 'No se pudo crear el item del cofre'), response.status)
  }
  const body = await response.json()
  return { id: body.id, expiresAt: body.expires_at }
}

export async function fetchVaultItem(id: string): Promise<VaultItem> {
  const response = await fetch(`${API_BASE_URL}/api/secret-vault/${id}`)
  if (!response.ok) {
    throw new VaultError(await parseErrorMessage(response, 'No se pudo consultar el cofre'), response.status)
  }
  return parseVaultItem(await response.json())
}

export async function copyVaultItem(id: string): Promise<VaultItem> {
  const response = await fetch(`${API_BASE_URL}/api/secret-vault/${id}/copy`, { method: 'POST' })
  if (!response.ok) {
    throw new VaultError(await parseErrorMessage(response, 'No se pudo copiar el contenido'), response.status)
  }
  return parseVaultItem(await response.json())
}
