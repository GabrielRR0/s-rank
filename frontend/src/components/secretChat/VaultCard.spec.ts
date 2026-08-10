import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { VaultPointer } from '../../composables/secretChat/useSecretChatRoom'
import { useVaultItem } from '../../composables/secretChat/useVaultItem'
import AudioPlayer from '../ui/AudioPlayer.vue'
import VaultCard from './VaultCard.vue'

vi.mock('../../composables/secretChat/useVaultItem', () => ({
  useVaultItem: vi.fn(),
}))

const VAULT: VaultPointer = {
  vaultId: 'v1',
  maxCopias: 3,
  expiraEn: '2026-01-01T00:00:00Z',
  copiasRestantes: 3,
  creadoEn: Date.now(),
}
const CLAVE_FALSA = {} as CryptoKey

function mockVaultItem(overrides: Partial<ReturnType<typeof useVaultItem>>) {
  vi.mocked(useVaultItem).mockReturnValue({
    estado: ref('disponible'),
    contentType: ref('text'),
    mimeType: ref(null),
    valorDescifrado: ref(''),
    valorDescifradoUrl: ref(null),
    valorDescifradoDatos: ref(null),
    revelado: ref(false),
    revelando: ref(false),
    errorRevelar: ref(''),
    revelar: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useVaultItem>)
}

describe('VaultCard', () => {
  it('muestra el texto descifrado (nunca un reproductor) cuando content_type es "text"', () => {
    mockVaultItem({ contentType: ref('text'), valorDescifrado: ref('mi-secreto'), revelado: ref(true) })

    const wrapper = mount(VaultCard, { props: { vault: VAULT, clave: CLAVE_FALSA } })

    expect(wrapper.find('.valor').text()).toBe('mi-secreto')
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('muestra el reproductor propio (AudioPlayer, nunca un <audio> nativo) cuando content_type es "audio" y esta revelado', () => {
    const datos = new ArrayBuffer(8)
    mockVaultItem({ contentType: ref('audio'), valorDescifradoDatos: ref(datos), revelado: ref(true) })

    const wrapper = mount(VaultCard, { props: { vault: VAULT, clave: CLAVE_FALSA } })

    expect(wrapper.findComponent(AudioPlayer).exists()).toBe(true)
    expect(wrapper.findComponent(AudioPlayer).props('datos')).toBe(datos)
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('muestra una imagen cuando content_type es "image" y esta revelado', () => {
    mockVaultItem({ contentType: ref('image'), valorDescifradoUrl: ref('blob:fake-imagen'), revelado: ref(true) })

    const wrapper = mount(VaultCard, { props: { vault: VAULT, clave: CLAVE_FALSA } })

    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('nunca asume audio: un content_type inesperado/faltante cae en el mensaje de no disponible', () => {
    // Bug real ya corregido: un backend desactualizado devolvia un item de
    // texto sin "content_type", y VaultCard.vue lo mostraba como audio
    // porque su rama de imagen/audio usaba un v-else generico. Este test
    // fija ese comportamiento para que no pueda volver a pasar en silencio.
    mockVaultItem({ contentType: ref(undefined as never), revelado: ref(true) })

    const wrapper = mount(VaultCard, { props: { vault: VAULT, clave: CLAVE_FALSA } })

    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.valor').exists()).toBe(false)
    expect(wrapper.find('.estado-texto').exists()).toBe(true)
  })

  it('muestra el estado de carga mientras estado es "cargando"', () => {
    mockVaultItem({ estado: ref('cargando') })

    const wrapper = mount(VaultCard, { props: { vault: VAULT, clave: CLAVE_FALSA } })

    expect(wrapper.find('.estado-texto').exists()).toBe(true)
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('muestra el mensaje de agotado cuando estado es "agotado"', () => {
    mockVaultItem({ estado: ref('agotado') })

    const wrapper = mount(VaultCard, { props: { vault: VAULT, clave: CLAVE_FALSA } })

    expect(wrapper.find('.estado-texto').exists()).toBe(true)
  })
})
