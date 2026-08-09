import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import type { VaultPointer } from '../../composables/secretChat/useSecretChatRoom'
import { useVaultItem } from '../../composables/secretChat/useVaultItem'
import MessageList from './MessageList.vue'

vi.mock('../../composables/secretChat/useVaultItem', () => ({
  useVaultItem: vi.fn(() => ({
    estado: ref('cargando'),
    contentType: ref('text'),
    mimeType: ref(null),
    valorDescifrado: ref(''),
    valorDescifradoUrl: ref(null),
    valorDescifradoDatos: ref(null),
    revelado: ref(false),
    copiando: ref(false),
    errorCopia: ref(''),
    alternarRevelado: vi.fn(),
    copiar: vi.fn(),
  })),
}))

const CLAVE_FALSA = {} as CryptoKey

function mensaje(id: string, enviadoEn: number): MensajeChat {
  return { id, autor: 'Ana', propio: false, enviadoEn, tipo: 'texto', texto: `texto-${id}` }
}

function vault(vaultId: string, creadoEn: number): VaultPointer {
  return { vaultId, maxCopias: 3, expiraEn: '2026-01-01T00:00:00Z', copiasRestantes: 3, creadoEn }
}

describe('MessageList - el Cofre se intercala dentro del chat, no en un panel aparte', () => {
  it('ordena mensajes y vaults por orden cronologico, mezclados en una sola lista', () => {
    const mensajes = [mensaje('m1', 1000), mensaje('m3', 3000)]
    const vaults = [vault('v1', 2000)]

    const wrapper = mount(MessageList, {
      props: { mensajes, vaults, clave: CLAVE_FALSA, ttlSegundos: 60 },
    })

    const items = wrapper.findAll('.message-bubble, .vault-card')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('texto-m1')
    expect(items[1].classes()).toContain('vault-card')
    expect(items[2].text()).toContain('texto-m3')
  })

  it('sin items del Cofre, solo se renderizan los mensajes (sin panel/seccion aparte)', () => {
    const mensajes = [mensaje('m1', 1000)]

    const wrapper = mount(MessageList, { props: { mensajes, vaults: [], clave: CLAVE_FALSA, ttlSegundos: 60 } })

    expect(wrapper.findAll('.message-bubble')).toHaveLength(1)
    expect(wrapper.find('.vault-card').exists()).toBe(false)
  })

  it('reenvia el evento "copiado" de VaultCard hacia arriba', async () => {
    vi.mocked(useVaultItem).mockReturnValue({
      estado: ref('disponible'),
      contentType: ref('text'),
      mimeType: ref(null),
      valorDescifrado: ref('secreto'),
      valorDescifradoUrl: ref(null),
      valorDescifradoDatos: ref(null),
      revelado: ref(true),
      copiando: ref(false),
      errorCopia: ref(''),
      alternarRevelado: vi.fn(),
      copiar: vi.fn().mockResolvedValue(2),
    } as unknown as ReturnType<typeof useVaultItem>)

    const wrapper = mount(MessageList, {
      props: { mensajes: [], vaults: [vault('v1', 1000)], clave: CLAVE_FALSA, ttlSegundos: 60 },
    })

    await wrapper.find('.vault-card .base-button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('copiado')).toEqual([['v1', 2]])
  })
})
