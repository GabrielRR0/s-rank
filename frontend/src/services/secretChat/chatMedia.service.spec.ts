import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatMediaError, fetchChatMedia, uploadChatMedia } from './chatMedia.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body } as unknown as Response
}

describe('chatMedia.service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('uploadChatMedia', () => {
    it('arma el multipart con todos los campos y el archivo cifrado', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'media-1', expires_at: '2026-01-01T00:00:00Z' }, { status: 201 }))

      const resultado = await uploadChatMedia({
        roomId: 'sala-1',
        nonce: 'nonce-b64',
        mimeType: 'image/png',
        ttlSeconds: 15,
        ciphertext: new Uint8Array([1, 2, 3]),
      })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/secret-chat-media')
      expect(init!.method).toBe('POST')
      const form = init!.body as FormData
      expect(form.get('room_id')).toBe('sala-1')
      expect(form.get('nonce')).toBe('nonce-b64')
      expect(form.get('mime_type')).toBe('image/png')
      expect(form.get('ttl_seconds')).toBe('15')
      expect(form.get('ciphertext_file')).toBeInstanceOf(Blob)
      expect(resultado).toEqual({ id: 'media-1', expiresAt: '2026-01-01T00:00:00Z' })
    })

    it('un error del backend (ej. 422 por mime_type invalido) lanza ChatMediaError', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'mime_type debe ser de imagen o audio.' }, { ok: false, status: 422 }))

      await expect(
        uploadChatMedia({ roomId: 'x', nonce: 'n', mimeType: 'application/pdf', ttlSeconds: 15, ciphertext: new Uint8Array() }),
      ).rejects.toMatchObject({ status: 422, message: 'mime_type debe ser de imagen o audio.' })
    })
  })

  describe('fetchChatMedia', () => {
    it('devuelve el item parseado desde snake_case a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ id: 'media-1', ciphertext: 'cGxhaW4', nonce: 'n', mime_type: 'image/png', expires_at: '2026-01-01T00:00:00Z' }),
      )

      const item = await fetchChatMedia('media-1')

      expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/secret-chat-media/media-1')
      expect(item).toEqual({
        id: 'media-1',
        ciphertext: 'cGxhaW4',
        nonce: 'n',
        mimeType: 'image/png',
        expiresAt: '2026-01-01T00:00:00Z',
      })
    })

    it('un 410 (vencido) lanza ChatMediaError', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'no existe' }, { ok: false, status: 410 }))

      await expect(fetchChatMedia('no-existe')).rejects.toBeInstanceOf(ChatMediaError)
      await expect(fetchChatMedia('no-existe')).rejects.toMatchObject({ status: 410 })
    })
  })
})
