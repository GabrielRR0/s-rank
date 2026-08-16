import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { MensajeChat } from '../../composables/secretChat/useEphemeralMessages'
import type { VaultPointer } from '../../composables/secretChat/useSecretChatRoom'
import { useVaultItem } from '../../composables/secretChat/useVaultItem'
import { definirMetricasScroll } from '../../test-support/domScrollMetrics'
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
    revelando: ref(false),
    errorRevelar: ref(''),
    revelar: vi.fn(),
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
      props: { mensajes, vaults, clave: CLAVE_FALSA, ttlSegundos: 60, noVistos: 0, reaccionesPorMensaje: {}, esVisto: () => false },
    })

    const items = wrapper.findAll('.message-bubble, .vault-card')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('texto-m1')
    expect(items[1].classes()).toContain('vault-card')
    expect(items[2].text()).toContain('texto-m3')
  })

  it('sin items del Cofre, solo se renderizan los mensajes (sin panel/seccion aparte)', () => {
    const mensajes = [mensaje('m1', 1000)]

    const wrapper = mount(MessageList, {
      props: { mensajes, vaults: [], clave: CLAVE_FALSA, ttlSegundos: 60, noVistos: 0, reaccionesPorMensaje: {}, esVisto: () => false },
    })

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
      revelado: ref(false),
      revelando: ref(false),
      errorRevelar: ref(''),
      revelar: vi.fn().mockResolvedValue(2),
    } as unknown as ReturnType<typeof useVaultItem>)

    const wrapper = mount(MessageList, {
      props: { mensajes: [], vaults: [vault('v1', 1000)], clave: CLAVE_FALSA, ttlSegundos: 60, noVistos: 0, reaccionesPorMensaje: {}, esVisto: () => false },
    })

    await wrapper.find('.vault-card .base-button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('copiado')).toEqual([['v1', 2]])
  })

  it('intercala un separador de fecha entre mensajes de dias distintos', () => {
    const dia1 = new Date('2026-08-14T10:00:00Z').getTime()
    const dia2 = new Date('2026-08-15T10:00:00Z').getTime()

    const wrapper = mount(MessageList, {
      props: {
        mensajes: [mensaje('m1', dia1), mensaje('m2', dia2)],
        vaults: [],
        clave: CLAVE_FALSA,
        ttlSegundos: 60,
        noVistos: 0,
        reaccionesPorMensaje: {},
        esVisto: () => false,
      },
    })

    expect(wrapper.findAll('.separador-fecha')).toHaveLength(2)
  })
})

describe('MessageList - auto-scroll inteligente', () => {
  it('si la persona esta cerca del fondo, un mensaje nuevo scrollea al final', async () => {
    const wrapper = mount(MessageList, {
      props: { mensajes: [mensaje('m1', 1000)], vaults: [], clave: CLAVE_FALSA, ttlSegundos: 60, noVistos: 0, reaccionesPorMensaje: {}, esVisto: () => false },
    })
    const el = wrapper.find('.message-list').element as HTMLDivElement
    definirMetricasScroll(el, { scrollTop: 0, scrollHeight: 500, clientHeight: 500 })

    await wrapper.setProps({ mensajes: [mensaje('m1', 1000), mensaje('m2', 2000)] })
    // El watcher que mueve el scroll es async y hace su propio await
    // nextTick() interno (ver MessageList.vue) - hace falta un tick extra
    // ademas del que ya espera setProps().
    await nextTick()

    expect(el.scrollTop).toBe(500)
  })

  it('si la persona esta scrolleada para arriba, un mensaje nuevo NO mueve el scroll', async () => {
    const wrapper = mount(MessageList, {
      props: { mensajes: [mensaje('m1', 1000)], vaults: [], clave: CLAVE_FALSA, ttlSegundos: 60, noVistos: 0, reaccionesPorMensaje: {}, esVisto: () => false },
    })
    const el = wrapper.find('.message-list').element as HTMLDivElement
    // Lejos del fondo: scrollHeight - scrollTop - clientHeight = 900 - 0 - 400 = 500 > umbral (80)
    definirMetricasScroll(el, { scrollTop: 0, scrollHeight: 900, clientHeight: 400 })
    await wrapper.find('.message-list').trigger('scroll')

    await wrapper.setProps({
      mensajes: [mensaje('m1', 1000), mensaje('m2', 2000)],
      noVistos: 1,
    })

    expect(el.scrollTop).toBe(0)
  })

  it('muestra el pill de mensajes nuevos cuando esta lejos del fondo y hay no vistos', async () => {
    const wrapper = mount(MessageList, {
      props: { mensajes: [mensaje('m1', 1000)], vaults: [], clave: CLAVE_FALSA, ttlSegundos: 60, noVistos: 0, reaccionesPorMensaje: {}, esVisto: () => false },
    })
    const el = wrapper.find('.message-list').element as HTMLDivElement
    definirMetricasScroll(el, { scrollTop: 0, scrollHeight: 900, clientHeight: 400 })
    await wrapper.find('.message-list').trigger('scroll')
    await wrapper.setProps({ noVistos: 3 })

    const pill = wrapper.find('.pill-nuevos')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toContain('3')
  })

  it('al tocar el pill, scrollea al fondo y avisa "todo-visto"', async () => {
    const wrapper = mount(MessageList, {
      props: {
        mensajes: [mensaje('m1', 1000)],
        vaults: [],
        clave: CLAVE_FALSA,
        ttlSegundos: 60,
        noVistos: 3,
        reaccionesPorMensaje: {},
        esVisto: () => false,
      },
    })
    const el = wrapper.find('.message-list').element as HTMLDivElement
    definirMetricasScroll(el, { scrollTop: 0, scrollHeight: 900, clientHeight: 400 })
    await wrapper.find('.message-list').trigger('scroll')

    await wrapper.find('.pill-nuevos').trigger('click')

    expect(el.scrollTop).toBe(900)
    expect(wrapper.emitted('todo-visto')).toHaveLength(1)
  })

  it('al volver a scrollear hasta el fondo por su cuenta, avisa "todo-visto"', async () => {
    const wrapper = mount(MessageList, {
      props: {
        mensajes: [mensaje('m1', 1000)],
        vaults: [],
        clave: CLAVE_FALSA,
        ttlSegundos: 60,
        noVistos: 2,
        reaccionesPorMensaje: {},
        esVisto: () => false,
      },
    })
    const el = wrapper.find('.message-list').element as HTMLDivElement

    definirMetricasScroll(el, { scrollTop: 500, scrollHeight: 900, clientHeight: 400 })
    await wrapper.find('.message-list').trigger('scroll')

    expect(wrapper.emitted('todo-visto')).toHaveLength(1)
  })
})
