import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShareResult from './ShareResult.vue'

const RESULTADO = { id: 'abc', urlPath: '/s/abc', expiresAt: '2026-01-01T00:00:00Z' }

describe('ShareResult', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('muestra la url completa combinando el origin actual con la ruta relativa', () => {
    const wrapper = mount(ShareResult, { props: { resultado: RESULTADO } })

    expect(wrapper.find('.enlace-texto').text()).toBe(`${window.location.origin}/s/abc`)
  })

  it('copia la url completa al portapapeles al hacer click en el boton de copiar', async () => {
    const wrapper = mount(ShareResult, { props: { resultado: RESULTADO } })

    await wrapper.find('.enlace-box button').trigger('click')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/s/abc`)
  })

  it('cambia el texto del boton al copiar, y vuelve al original pasados 2 segundos', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ShareResult, { props: { resultado: RESULTADO } })
    const boton = () => wrapper.find('.enlace-box button')
    const textoOriginal = boton().text()

    await boton().trigger('click')
    await flushPromises()
    expect(boton().text()).not.toBe(textoOriginal)

    await vi.advanceTimersByTimeAsync(2000)
    expect(boton().text()).toBe(textoOriginal)

    vi.useRealTimers()
  })

  it('emite reiniciar al hacer click en "compartir algo mas"', async () => {
    const wrapper = mount(ShareResult, { props: { resultado: RESULTADO } })

    await wrapper.find('.crear-otro').trigger('click')

    expect(wrapper.emitted('reiniciar')).toHaveLength(1)
  })
})
