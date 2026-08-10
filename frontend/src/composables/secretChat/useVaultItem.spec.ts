import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { bytesABase64Url, cifrarBinario, cifrarTexto, generarClaveSala } from '../../services/secretChat/crypto.service'
import { copyVaultItem, fetchVaultItem, VaultError, type VaultItem } from '../../services/secretChat/vault.service'
import { useVaultItem } from './useVaultItem'

vi.mock('../../services/secretChat/vault.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/secretChat/vault.service')>()
  return { ...actual, fetchVaultItem: vi.fn(), copyVaultItem: vi.fn() }
})

function montarVaultItem(vaultId: string, clave: CryptoKey) {
  let composable!: ReturnType<typeof useVaultItem>
  mount(
    defineComponent({
      setup() {
        composable = useVaultItem(vaultId, clave)
        return () => h('div')
      },
    }),
  )
  return composable
}

function itemBase(overrides: Partial<VaultItem> = {}): VaultItem {
  return {
    id: 'v1',
    ciphertext: null,
    nonce: 'n',
    maxCopies: 3,
    remainingCopies: 3,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    contentType: 'text',
    mimeType: null,
    ...overrides,
  }
}

describe('useVaultItem', () => {
  beforeEach(() => {
    vi.mocked(fetchVaultItem).mockReset()
    vi.mocked(copyVaultItem).mockReset()
    useLocale().locale.value = 'es'
  })

  it('carga y descifra un item de texto', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, 'la contraseña del wifi es 1234')
    vi.mocked(fetchVaultItem).mockResolvedValue(itemBase({ ciphertext: cifrado.ciphertext, nonce: cifrado.nonce }))

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('disponible'))

    expect(composable.valorDescifrado.value).toBe('la contraseña del wifi es 1234')
    expect(composable.contentType.value).toBe('text')
  })

  it('carga y descifra un item de imagen a un Blob URL', async () => {
    const clave = await generarClaveSala()
    const datosOriginales = new Uint8Array([1, 2, 3, 4]).buffer
    const cifrado = await cifrarBinario(clave, datosOriginales)
    vi.mocked(fetchVaultItem).mockResolvedValue(
      itemBase({
        contentType: 'image',
        mimeType: 'image/png',
        ciphertext: bytesABase64Url(cifrado.ciphertext),
        nonce: cifrado.nonce,
      }),
    )
    const crearObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vault-imagen')

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('disponible'))

    expect(composable.valorDescifradoUrl.value).toBe('blob:vault-imagen')
    crearObjectUrl.mockRestore()
  })

  it('carga y descifra un item de audio a un ArrayBuffer crudo (no Blob URL)', async () => {
    const clave = await generarClaveSala()
    const datosOriginales = new Uint8Array([9, 9, 9]).buffer
    const cifrado = await cifrarBinario(clave, datosOriginales)
    vi.mocked(fetchVaultItem).mockResolvedValue(
      itemBase({
        contentType: 'audio',
        mimeType: 'audio/webm',
        ciphertext: bytesABase64Url(cifrado.ciphertext),
        nonce: cifrado.nonce,
      }),
    )

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('disponible'))

    expect(new Uint8Array(composable.valorDescifradoDatos.value!)).toEqual(new Uint8Array(datosOriginales))
    expect(composable.valorDescifradoUrl.value).toBeNull()
  })

  it('si fetchVaultItem falla (410, agotado o vencido), estado pasa a agotado', async () => {
    const clave = await generarClaveSala()
    vi.mocked(fetchVaultItem).mockRejectedValue(new VaultError('agotado', 410))

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('agotado'))
  })

  it('si la clave es incorrecta (link mal copiado), el descifrado falla y cae en agotado, no en un crash', async () => {
    const clave = await generarClaveSala()
    const otraClave = await generarClaveSala()
    const cifrado = await cifrarTexto(otraClave, 'secreto')
    vi.mocked(fetchVaultItem).mockResolvedValue(itemBase({ ciphertext: cifrado.ciphertext, nonce: cifrado.nonce }))

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('agotado'))
  })

  it('revelar() consume una copia y devuelve remainingCopies; pasa a agotado cuando llega a 0', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, 'x')
    vi.mocked(fetchVaultItem).mockResolvedValue(itemBase({ ciphertext: cifrado.ciphertext, nonce: cifrado.nonce, remainingCopies: 1 }))
    vi.mocked(copyVaultItem).mockResolvedValue(itemBase({ remainingCopies: 0 }))

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('disponible'))

    const restantes = await composable.revelar()

    expect(restantes).toBe(0)
    expect(composable.revelado.value).toBe(true)
    expect(composable.estado.value).toBe('agotado')
  })

  it('revelar() con copias restantes > 0 no marca agotado', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, 'x')
    vi.mocked(fetchVaultItem).mockResolvedValue(itemBase({ ciphertext: cifrado.ciphertext, nonce: cifrado.nonce }))
    vi.mocked(copyVaultItem).mockResolvedValue(itemBase({ remainingCopies: 1 }))

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('disponible'))
    await composable.revelar()

    expect(composable.estado.value).toBe('disponible')
  })

  it('revelar() con 410 (otro participante ya lo agoto primero) marca agotado', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, 'x')
    vi.mocked(fetchVaultItem).mockResolvedValue(itemBase({ ciphertext: cifrado.ciphertext, nonce: cifrado.nonce }))
    vi.mocked(copyVaultItem).mockRejectedValue(new VaultError('ya no disponible', 410))

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('disponible'))
    const resultado = await composable.revelar()

    expect(resultado).toBeNull()
    expect(composable.estado.value).toBe('agotado')
  })

  it('revelar() con un error de red (no 410) muestra errorRevelar sin marcar agotado', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, 'x')
    vi.mocked(fetchVaultItem).mockResolvedValue(itemBase({ ciphertext: cifrado.ciphertext, nonce: cifrado.nonce }))
    vi.mocked(copyVaultItem).mockRejectedValue(new TypeError('Failed to fetch'))

    const composable = montarVaultItem('v1', clave)
    await vi.waitFor(() => expect(composable.estado.value).toBe('disponible'))
    const resultado = await composable.revelar()

    expect(resultado).toBeNull()
    expect(composable.errorRevelar.value).toBe('No se pudo mostrar el contenido.')
    expect(composable.estado.value).toBe('disponible')
  })
})
