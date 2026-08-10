import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyVaultItem, createVaultItem, createVaultMediaItem, fetchVaultItem, VaultError } from './vault.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body } as unknown as Response
}

describe('vault.service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createVaultItem', () => {
    it('manda ciphertext/nonce/max_copies/ttl_seconds/room_id en JSON', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'v1', expires_at: '2026-01-01T00:00:00Z' }, { status: 201 }))

      await createVaultItem({ ciphertext: 'c', nonce: 'n', maxCopies: 3, ttlSeconds: 60, roomId: 'sala-1' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/secret-vault')
      expect(JSON.parse(init!.body as string)).toEqual({
        ciphertext: 'c',
        nonce: 'n',
        max_copies: 3,
        ttl_seconds: 60,
        room_id: 'sala-1',
      })
    })

    it('sin roomId, manda room_id: null (no undefined, para no romper el JSON esperado por el backend)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'v1', expires_at: 'x' }, { status: 201 }))

      await createVaultItem({ ciphertext: 'c', nonce: 'n', maxCopies: 1, ttlSeconds: 30 })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body.room_id).toBeNull()
    })

    it('un 422 (max_copies fuera de rango) lanza VaultError', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'max_copies debe estar entre 1 y 6.' }, { ok: false, status: 422 }))

      await expect(createVaultItem({ ciphertext: 'c', nonce: 'n', maxCopies: 99, ttlSeconds: 30 })).rejects.toMatchObject({
        status: 422,
      })
    })
  })

  describe('createVaultMediaItem', () => {
    it('arma el multipart con todos los campos', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'v2', expires_at: 'x' }, { status: 201 }))

      await createVaultMediaItem({
        contentType: 'image',
        mimeType: 'image/png',
        maxCopies: 2,
        ttlSeconds: 45,
        nonce: 'n',
        ciphertext: new Uint8Array([1, 2]),
        roomId: 'sala-1',
      })

      const form = vi.mocked(fetch).mock.calls[0][1]!.body as FormData
      expect(form.get('content_type')).toBe('image')
      expect(form.get('mime_type')).toBe('image/png')
      expect(form.get('max_copies')).toBe('2')
      expect(form.get('room_id')).toBe('sala-1')
    })

    it('sin roomId, no incluye el campo room_id en el form (a diferencia del texto, que manda null explicito)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'v2', expires_at: 'x' }, { status: 201 }))

      await createVaultMediaItem({
        contentType: 'audio',
        mimeType: 'audio/webm',
        maxCopies: 1,
        ttlSeconds: 30,
        nonce: 'n',
        ciphertext: new Uint8Array([1]),
      })

      const form = vi.mocked(fetch).mock.calls[0][1]!.body as FormData
      expect(form.has('room_id')).toBe(false)
    })
  })

  describe('fetchVaultItem / copyVaultItem', () => {
    it('fetchVaultItem parsea snake_case a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({
          id: 'v1',
          ciphertext: 'c',
          nonce: 'n',
          max_copies: 3,
          remaining_copies: 2,
          expires_at: 'x',
          content_type: 'text',
          mime_type: null,
        }),
      )

      const item = await fetchVaultItem('v1')

      expect(item).toEqual({
        id: 'v1',
        ciphertext: 'c',
        nonce: 'n',
        maxCopies: 3,
        remainingCopies: 2,
        expiresAt: 'x',
        contentType: 'text',
        mimeType: null,
      })
    })

    it('copyVaultItem hace POST a /copy y devuelve el item actualizado', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ id: 'v1', ciphertext: 'c', nonce: 'n', max_copies: 3, remaining_copies: 1, expires_at: 'x', content_type: 'text', mime_type: null }),
      )

      const item = await copyVaultItem('v1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/secret-vault/v1/copy')
      expect(init!.method).toBe('POST')
      expect(item.remainingCopies).toBe(1)
    })

    it('copyVaultItem con 410 (agotado) lanza VaultError', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'agotado' }, { ok: false, status: 410 }))

      await expect(copyVaultItem('v1')).rejects.toBeInstanceOf(VaultError)
      await expect(copyVaultItem('v1')).rejects.toMatchObject({ status: 410 })
    })
  })
})
