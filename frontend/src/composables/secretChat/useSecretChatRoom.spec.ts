import { mount } from '@vue/test-utils'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createFakeRealtimeBus, type FakeChannelView } from '../../test-support/fakeRealtimeChannel'
import { generarClaveSala } from '../../services/secretChat/crypto.service'
import { useSecretChatRoom } from './useSecretChatRoom'

vi.mock('../../services/secretChat/realtime.service', () => ({
  getRoomChannel: vi.fn(),
  getPresenceKey: vi.fn(),
  removeRoomChannel: vi.fn(),
  setRealtimeAuth: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../services/secretChat/chatMedia.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/secretChat/chatMedia.service')>()
  return { ...actual, uploadChatMedia: vi.fn(), fetchChatMedia: vi.fn() }
})

import { getPresenceKey, getRoomChannel, removeRoomChannel } from '../../services/secretChat/realtime.service'
import { fetchChatMedia, uploadChatMedia } from '../../services/secretChat/chatMedia.service'

// Test de integracion: simula DOS (o tres) participantes REALES conectados
// a la misma sala, usando el mismo FakeRealtimeBus por debajo, para
// verificar el camino completo cifrado-en-el-navegador -> broadcast ->
// descifrado-del-otro-lado - no unidades aisladas, sino el flujo tal como
// lo viviria gente real usando la app desde dos pestañas distintas.

function montarParticipante(vista: FakeChannelView, presenceKey: string, roomId: string, clave: CryptoKey, apodo: string, capacidadMaxima = 6) {
  vi.mocked(getRoomChannel).mockReturnValueOnce(vista as unknown as RealtimeChannel)
  vi.mocked(getPresenceKey).mockReturnValueOnce(presenceKey)

  let composable!: ReturnType<typeof useSecretChatRoom>
  mount(
    defineComponent({
      setup() {
        composable = useSecretChatRoom(roomId, clave, apodo, { capacidadMaxima, ttlSegundos: 60 })
        return () => h('div')
      },
    }),
  )
  return composable
}

async function esperarConectado(...composables: Array<ReturnType<typeof useSecretChatRoom>>) {
  for (const c of composables) {
    await vi.waitFor(() => expect(c.estado.value).toBe('conectado'))
  }
}

describe('useSecretChatRoom - integracion con 2-3 participantes reales', () => {
  beforeEach(() => {
    vi.mocked(getRoomChannel).mockReset()
    vi.mocked(getPresenceKey).mockReset()
    vi.mocked(removeRoomChannel).mockReset()
    vi.mocked(uploadChatMedia).mockReset()
    vi.mocked(fetchChatMedia).mockReset()
  })

  it('un mensaje de texto enviado por A llega descifrado a B, con el autor correcto', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const roomId = 'sala-mensajes'
    const a = montarParticipante(bus.createView('clave-a'), 'clave-a', roomId, clave, 'Ana')
    const b = montarParticipante(bus.createView('clave-b'), 'clave-b', roomId, clave, 'Beto')
    await esperarConectado(a, b)

    await a.enviarMensaje('hola beto, es un secreto')

    expect(a.mensajes.value).toContainEqual(
      expect.objectContaining({ autor: 'Ana', texto: 'hola beto, es un secreto', propio: true }),
    )
    await vi.waitFor(() =>
      expect(b.mensajes.value).toContainEqual(
        expect.objectContaining({ autor: 'Ana', texto: 'hola beto, es un secreto', propio: false }),
      ),
    )
  })

  it('un mensaje vacio/solo-espacios no se envia', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const roomId = 'sala-vacio'
    const a = montarParticipante(bus.createView('clave-a'), 'clave-a', roomId, clave, 'Ana')
    const b = montarParticipante(bus.createView('clave-b'), 'clave-b', roomId, clave, 'Beto')
    await esperarConectado(a, b)

    await a.enviarMensaje('   ')

    expect(a.mensajes.value).toHaveLength(0)
    expect(b.mensajes.value).toHaveLength(0)
  })

  it('un puntero de media (imagen) sube el archivo y viaja como pointer, no como bytes crudos por el broadcast', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const roomId = 'sala-media'
    const a = montarParticipante(bus.createView('clave-a'), 'clave-a', roomId, clave, 'Ana')
    const b = montarParticipante(bus.createView('clave-b'), 'clave-b', roomId, clave, 'Beto')
    await esperarConectado(a, b)

    const datosOriginales = new Uint8Array([10, 20, 30, 40]).buffer
    vi.mocked(uploadChatMedia).mockResolvedValue({ id: 'media-1', expiresAt: new Date().toISOString() })
    // fetchChatMedia devuelve el mismo contenido re-cifrado con la clave de
    // la sala, como haria el backend real (el backend nunca ve el
    // plaintext - ver crypto.service.ts) - B lo pide y lo descifra solo.
    const { cifrarBinario, bytesABase64Url } = await import('../../services/secretChat/crypto.service')
    const recifrado = await cifrarBinario(clave, datosOriginales)
    vi.mocked(fetchChatMedia).mockResolvedValue({
      id: 'media-1',
      ciphertext: bytesABase64Url(recifrado.ciphertext),
      nonce: recifrado.nonce,
      mimeType: 'image/png',
      expiresAt: new Date().toISOString(),
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:media-imagen')

    await a.enviarMedia(datosOriginales, 'image/png')

    expect(uploadChatMedia).toHaveBeenCalledOnce()
    await vi.waitFor(() =>
      expect(b.mensajes.value).toContainEqual(
        expect.objectContaining({ autor: 'Ana', tipo: 'media', mimeType: 'image/png', mediaUrl: 'blob:media-imagen' }),
      ),
    )
  })

  it('un vault-pointer compartido por A aparece en la lista de vaults de B, y una actualizacion de copias se propaga', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const roomId = 'sala-vault'
    const a = montarParticipante(bus.createView('clave-a'), 'clave-a', roomId, clave, 'Ana')
    const b = montarParticipante(bus.createView('clave-b'), 'clave-b', roomId, clave, 'Beto')
    await esperarConectado(a, b)

    a.compartirVault('vault-1', 3, new Date(Date.now() + 60_000).toISOString())

    expect(a.vaults.value).toContainEqual(expect.objectContaining({ vaultId: 'vault-1', copiasRestantes: 3 }))
    await vi.waitFor(() =>
      expect(b.vaults.value).toContainEqual(expect.objectContaining({ vaultId: 'vault-1', copiasRestantes: 3 })),
    )

    // B "copia" el secreto - el contador autoritativo lo devuelve el
    // backend (mockeado aca como 2 restantes) y se propaga a todos.
    b.notificarCopiaVault('vault-1', 2)

    await vi.waitFor(() =>
      expect(a.vaults.value).toContainEqual(expect.objectContaining({ vaultId: 'vault-1', copiasRestantes: 2 })),
    )
  })

  it('cuando un vault llega a 0 copias, se saca de la lista de todos los participantes', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const roomId = 'sala-vault-agotado'
    const a = montarParticipante(bus.createView('clave-a'), 'clave-a', roomId, clave, 'Ana')
    const b = montarParticipante(bus.createView('clave-b'), 'clave-b', roomId, clave, 'Beto')
    await esperarConectado(a, b)

    a.compartirVault('vault-x', 1, new Date(Date.now() + 60_000).toISOString())
    await vi.waitFor(() => expect(b.vaults.value.some((v) => v.vaultId === 'vault-x')).toBe(true))

    a.notificarCopiaVault('vault-x', 0)

    expect(a.vaults.value.some((v) => v.vaultId === 'vault-x')).toBe(false)
    await vi.waitFor(() => expect(b.vaults.value.some((v) => v.vaultId === 'vault-x')).toBe(false))
  })

  it('un voto de expulsion que alcanza mayoria saca efectivamente al objetivo de la sala', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const roomId = 'sala-expulsion'
    const a = montarParticipante(bus.createView('clave-a'), 'clave-a', roomId, clave, 'Ana')
    const b = montarParticipante(bus.createView('clave-b'), 'clave-b', roomId, clave, 'Beto') // objetivo
    const c = montarParticipante(bus.createView('clave-c'), 'clave-c', roomId, clave, 'Cari')
    await esperarConectado(a, b, c)
    expect(a.ocupantes.value).toBe(3)

    a.iniciarVoto('clave-b') // 1er voto (el propio de a)
    await vi.waitFor(() => expect(b.votoActivo.value).not.toBeNull())
    c.votar() // 2do voto -> mayoria de 3 (floor(3/2)+1=2)

    await vi.waitFor(() => expect(b.expulsado.value).toBe(true))
    expect(a.expulsado.value).toBe(false)
    expect(c.expulsado.value).toBe(false)
  })

  it('un mensaje con un envelope que no descifra con la clave de la sala (link de OTRA sala) se descarta en silencio', async () => {
    const bus = createFakeRealtimeBus()
    const clave = await generarClaveSala()
    const claveIntrusa = await generarClaveSala()
    const roomId = 'sala-intruso'
    const a = montarParticipante(bus.createView('clave-a'), 'clave-a', roomId, clave, 'Ana')
    const intruso = montarParticipante(bus.createView('clave-intruso'), 'clave-intruso', roomId, claveIntrusa, 'Intruso')
    await esperarConectado(a, intruso)

    await intruso.enviarMensaje('esto nunca deberia poder leerse')

    // Espera un poco para darle tiempo al handler (que va a fallar y
    // descartar en silencio) y confirma que a.mensajes NUNCA se puebla.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(a.mensajes.value).toHaveLength(0)
  })
})
