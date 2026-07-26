import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFileShare,
  createTextShare,
  fetchShareStatus,
  revealShare,
  ShareRevealError,
} from './sharing.service'

function mockResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; headers?: Record<string, string>; blobContent?: BlobPart[] } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers ?? { 'content-type': 'application/json' }),
    json: async () => body,
    blob: async () => new Blob(init.blobContent ?? []),
  } as unknown as Response
}

describe('sharing.service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createTextShare', () => {
    it('manda content_type, texto y expiracion en el FormData, sin password ni turnstile_token', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ id: 'abc', url_path: '/s/abc', expires_at: '2026-01-01T00:00:00Z' }),
      )

      const resultado = await createTextShare('hola mundo', null, 60)

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      const form = init!.body as FormData
      expect(url).toBe('/api/shared-content')
      expect(init!.method).toBe('POST')
      expect(form.get('content_type')).toBe('text')
      expect(form.get('text')).toBe('hola mundo')
      expect(form.get('expires_in_minutes')).toBe('60')
      expect(form.get('password')).toBeNull()
      expect(form.get('turnstile_token')).toBeNull()
      expect(resultado).toEqual({ id: 'abc', urlPath: '/s/abc', expiresAt: '2026-01-01T00:00:00Z' })
    })

    it('incluye la contraseña y el token de turnstile cuando se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ id: 'abc', url_path: '/s/abc', expires_at: '2026-01-01T00:00:00Z' }),
      )

      await createTextShare('hola', 'secreta123', 60, 'token-turnstile')

      const form = vi.mocked(fetch).mock.calls[0][1]!.body as FormData
      expect(form.get('password')).toBe('secreta123')
      expect(form.get('turnstile_token')).toBe('token-turnstile')
    })

    it('lanza un error con el detalle que manda el backend cuando la respuesta no es ok', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: 'Duracion de expiracion no permitida.' }, { ok: false, status: 422 }),
      )

      await expect(createTextShare('hola', null, 999)).rejects.toThrow('Duracion de expiracion no permitida.')
    })
  })

  describe('createFileShare', () => {
    it('incluye el archivo en el FormData con content_type=file', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ id: 'abc', url_path: '/s/abc', expires_at: '2026-01-01T00:00:00Z' }),
      )
      const archivo = new File([new Uint8Array(10)], 'foto.png', { type: 'image/png' })

      await createFileShare(archivo, null, 60)

      const form = vi.mocked(fetch).mock.calls[0][1]!.body as FormData
      expect(form.get('content_type')).toBe('file')
      expect(form.get('file')).toBe(archivo)
    })
  })

  describe('fetchShareStatus', () => {
    it('mapea los campos snake_case del backend a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ exists: true, requires_password: true, content_type: 'file', file_name: null }),
      )

      const status = await fetchShareStatus('abc')

      expect(status).toEqual({ exists: true, requiresPassword: true, contentType: 'file', fileName: null })
      expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/shared-content/abc')
    })

    it('lanza un error si la respuesta no es ok', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { ok: false, status: 500 }))

      await expect(fetchShareStatus('abc')).rejects.toThrow()
    })
  })

  describe('revealShare', () => {
    it('devuelve texto cuando la respuesta es JSON', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ text: 'secreto' }))

      const resultado = await revealShare('abc', null)

      expect(resultado).toEqual({ contentType: 'text', text: 'secreto' })
    })

    it('devuelve un blob con el nombre de archivo tomado del Content-Disposition cuando la respuesta es binaria', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse(null, {
          headers: { 'content-type': 'image/png', 'content-disposition': 'inline; filename="foto.png"' },
          blobContent: [new Uint8Array([1, 2, 3])],
        }),
      )

      const resultado = await revealShare('abc', null)

      expect(resultado.contentType).toBe('file')
      if (resultado.contentType === 'file') {
        expect(resultado.fileName).toBe('foto.png')
        expect(resultado.blob).toBeInstanceOf(Blob)
      }
    })

    it('usa "archivo" como nombre por defecto si no hay Content-Disposition con filename', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { headers: { 'content-type': 'application/octet-stream' } }))

      const resultado = await revealShare('abc', null)

      expect(resultado.contentType).toBe('file')
      if (resultado.contentType === 'file') expect(resultado.fileName).toBe('archivo')
    })

    it('lanza ShareRevealError con el status HTTP cuando la respuesta no es ok', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: 'Contraseña incorrecta.' }, { ok: false, status: 401 }),
      )

      const error: unknown = await revealShare('abc', 'mala').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ShareRevealError)
      expect((error as ShareRevealError).status).toBe(401)
      expect((error as ShareRevealError).message).toBe('Contraseña incorrecta.')
    })
  })
})
