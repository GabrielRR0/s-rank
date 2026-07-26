export type Locale = 'es' | 'en'
export type ContentType = 'text' | 'file'

export interface CreateShareResult {
  id: string
  urlPath: string
  expiresAt: string
}

export interface ShareStatus {
  exists: boolean
  requiresPassword: boolean
  contentType: ContentType | null
  fileName: string | null
}

export interface RevealedText {
  contentType: 'text'
  text: string
}

export interface RevealedFile {
  contentType: 'file'
  blob: Blob
  fileName: string
}

// Se distingue del Error generico para que useOneTimeView pueda diferenciar
// "contraseña incorrecta" (401, se puede reintentar) de cualquier otro caso
// (410 vencido/ya visto, o de red) - ver composables/fileSharing/README.md.
export class ShareRevealError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Sin VITE_API_BASE_URL, queda '' y las rutas quedan relativas ('/api/...'):
// funciona en dev via el proxy de vite.config.ts. En produccion (frontend y
// backend en dominios distintos), se define esta variable con la URL real
// del backend desplegado.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

interface CreateShareParams {
  contentType: ContentType
  text?: string
  file?: File
  password: string | null
  expiresInMinutes: number
  turnstileToken?: string | null
}

async function createShare(params: CreateShareParams): Promise<CreateShareResult> {
  // multipart/form-data siempre (incluso para texto): el backend expone un
  // unico endpoint para los dos casos, ver backend/app/schemas/sharedContent/README.md.
  const form = new FormData()
  form.set('content_type', params.contentType)
  form.set('expires_in_minutes', String(params.expiresInMinutes))
  if (params.text !== undefined) form.set('text', params.text)
  if (params.file !== undefined) form.set('file', params.file)
  if (params.password) form.set('password', params.password)
  // Solo se manda si Turnstile esta habilitado del lado del frontend - si
  // esta apagado (default), turnstileToken siempre es null/undefined y el
  // backend tampoco lo exige (ver useTurnstile.ts y backend/README.md #11).
  if (params.turnstileToken) form.set('turnstile_token', params.turnstileToken)

  const response = await fetch(`${API_BASE_URL}/api/shared-content`, { method: 'POST', body: form })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'No se pudo crear el enlace'))
  }
  const body = await response.json()
  return { id: body.id, urlPath: body.url_path, expiresAt: body.expires_at }
}

export function createTextShare(
  text: string,
  password: string | null,
  expiresInMinutes: number,
  turnstileToken?: string | null,
): Promise<CreateShareResult> {
  return createShare({ contentType: 'text', text, password, expiresInMinutes, turnstileToken })
}

export function createFileShare(
  file: File,
  password: string | null,
  expiresInMinutes: number,
  turnstileToken?: string | null,
): Promise<CreateShareResult> {
  return createShare({ contentType: 'file', file, password, expiresInMinutes, turnstileToken })
}

export async function fetchShareStatus(id: string): Promise<ShareStatus> {
  const response = await fetch(`${API_BASE_URL}/api/shared-content/${id}`)
  if (!response.ok) throw new Error('No se pudo consultar el enlace')
  const body = await response.json()
  return {
    exists: body.exists,
    requiresPassword: body.requires_password,
    contentType: body.content_type,
    fileName: body.file_name,
  }
}

export async function revealShare(id: string, password: string | null): Promise<RevealedText | RevealedFile> {
  const response = await fetch(`${API_BASE_URL}/api/shared-content/${id}/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })

  if (!response.ok) {
    throw new ShareRevealError(await parseErrorMessage(response, 'No se pudo mostrar el contenido'), response.status)
  }

  // El backend devuelve JSON para texto, binario crudo para archivos (ver
  // routers/sharedContent/README.md del backend) - se distingue por el
  // Content-Type real de la respuesta, no por un campo dentro del body.
  const contentTypeHeader = response.headers.get('content-type') ?? ''
  if (contentTypeHeader.includes('application/json')) {
    const body = await response.json()
    return { contentType: 'text', text: body.text }
  }

  const disposition = response.headers.get('content-disposition') ?? ''
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'archivo'
  return { contentType: 'file', blob: await response.blob(), fileName }
}
