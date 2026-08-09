export interface ChatMediaItem {
  id: string
  ciphertext: string
  nonce: string
  mimeType: string
  expiresAt: string
}

// Se distingue del Error generico para que useSecretChatRoom pueda
// diferenciar "ya no esta disponible" (410) de un error de red - mismo
// criterio que VaultError/ShareRevealError.
export class ChatMediaError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

interface UploadChatMediaParams {
  roomId: string
  nonce: string
  mimeType: string
  ttlSeconds: number
  ciphertext: Uint8Array<ArrayBuffer>
}

// multipart/form-data (no JSON): mismo motivo que el resto de las subidas
// binarias de este proyecto - ver backend/app/routers/secretChatMedia/README.md.
export async function uploadChatMedia(params: UploadChatMediaParams): Promise<{ id: string; expiresAt: string }> {
  const formData = new FormData()
  formData.append('room_id', params.roomId)
  formData.append('nonce', params.nonce)
  formData.append('mime_type', params.mimeType)
  formData.append('ttl_seconds', String(params.ttlSeconds))
  formData.append('ciphertext_file', new Blob([params.ciphertext]), 'ciphertext.bin')

  const response = await fetch(`${API_BASE_URL}/api/secret-chat-media`, { method: 'POST', body: formData })
  if (!response.ok) {
    throw new ChatMediaError(await parseErrorMessage(response, 'No se pudo enviar el archivo.'), response.status)
  }
  const body = await response.json()
  return { id: body.id, expiresAt: body.expires_at }
}

export async function fetchChatMedia(id: string): Promise<ChatMediaItem> {
  const response = await fetch(`${API_BASE_URL}/api/secret-chat-media/${id}`)
  if (!response.ok) {
    throw new ChatMediaError(await parseErrorMessage(response, 'No se pudo obtener el archivo.'), response.status)
  }
  const body = await response.json()
  return { id: body.id, ciphertext: body.ciphertext, nonce: body.nonce, mimeType: body.mime_type, expiresAt: body.expires_at }
}
