import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoomWithPassword, fetchInitialTokens, RealtimeAuthError, refreshAccessToken } from './realtimeAuth.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

describe('realtimeAuth.service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createRoomWithPassword', () => {
    it('manda room_id, password y turnstile_token en el body JSON', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({
          access_token: 'a',
          access_expires_at: '2026-01-01T00:00:00Z',
          session_token: 's',
          session_expires_at: '2026-01-01T01:00:00Z',
        }),
      )

      const resultado = await createRoomWithPassword('room-1', 'clave123', 'turnstile-abc')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/secret-chat/rooms')
      expect(init!.method).toBe('POST')
      expect(JSON.parse(init!.body as string)).toEqual({
        room_id: 'room-1',
        password: 'clave123',
        turnstile_token: 'turnstile-abc',
      })
      expect(resultado).toEqual({
        accessToken: 'a',
        accessExpiresAt: '2026-01-01T00:00:00Z',
        sessionToken: 's',
        sessionExpiresAt: '2026-01-01T01:00:00Z',
      })
    })

    it('un 409 (sala duplicada) lanza RealtimeAuthError con status 409', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: "La sala 'x' ya existe." }, { ok: false, status: 409 }))

      await expect(createRoomWithPassword('room-1', 'clave', null)).rejects.toMatchObject({
        status: 409,
        message: "La sala 'x' ya existe.",
      })
    })
  })

  describe('fetchInitialTokens', () => {
    it('manda password null cuando no se pasa', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ access_token: 'a', access_expires_at: 'x', session_token: 's', session_expires_at: 'y' }),
      )

      await fetchInitialTokens('room-1', null)

      const [, init] = vi.mocked(fetch).mock.calls[0]
      expect(JSON.parse(init!.body as string)).toEqual({ room_id: 'room-1', turnstile_token: null, password: null })
    })

    it('un 401 (password incorrecta) lanza RealtimeAuthError con status 401', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Contraseña incorrecta.' }, { ok: false, status: 401 }))

      await expect(fetchInitialTokens('room-1', null, 'mala')).rejects.toBeInstanceOf(RealtimeAuthError)
      await expect(fetchInitialTokens('room-1', null, 'mala')).rejects.toMatchObject({ status: 401 })
    })

    it('un 429 (bloqueado por bot_guard) lanza RealtimeAuthError con status 429', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Demasiados intentos.' }, { ok: false, status: 429 }))

      await expect(fetchInitialTokens('room-1', null)).rejects.toMatchObject({ status: 429 })
    })

    it('si el body de error no es JSON valido, cae al mensaje default sin crashear', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      } as unknown as Response)

      await expect(fetchInitialTokens('room-1', null)).rejects.toMatchObject({
        status: 500,
        message: 'No se pudo conectar a la sala',
      })
    })
  })

  describe('refreshAccessToken', () => {
    it('manda room_id y session_token, devuelve accessToken/accessExpiresAt', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ access_token: 'nuevo', access_expires_at: '2026-02-01T00:00:00Z' }))

      const resultado = await refreshAccessToken('room-1', 'session-token-abc')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/secret-chat/realtime-token/refresh')
      expect(JSON.parse(init!.body as string)).toEqual({ room_id: 'room-1', session_token: 'session-token-abc' })
      expect(resultado).toEqual({ accessToken: 'nuevo', accessExpiresAt: '2026-02-01T00:00:00Z' })
    })

    it('un 401 (session_token invalido/vencido) lanza RealtimeAuthError con status 401', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'invalido' }, { ok: false, status: 401 }))

      await expect(refreshAccessToken('room-1', 'basura')).rejects.toMatchObject({ status: 401 })
    })
  })
})
