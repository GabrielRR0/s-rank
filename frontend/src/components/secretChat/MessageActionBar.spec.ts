import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MessageActionBar, { type RectoAncla } from './MessageActionBar.vue'

const ANCLAJE: RectoAncla = { top: 100, bottom: 140, left: 20, right: 220 }

function montar(props: Partial<InstanceType<typeof MessageActionBar>['$props']> = {}) {
  return mount(MessageActionBar, { props: { anclaje: ANCLAJE, ...props }, attachTo: document.body })
}

describe('MessageActionBar', () => {
  it('emite "reaccionar" con el emoji tocado', async () => {
    const wrapper = montar()

    await document.querySelectorAll('.boton-emoji')[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('reaccionar')).toEqual([['👍']])
    wrapper.unmount()
  })

  it('emite "responder" y "copiar" al tocar cada accion', async () => {
    const wrapper = montar()
    const acciones = document.querySelectorAll('.boton-accion')

    acciones[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('responder')).toHaveLength(1)

    acciones[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('copiar')).toHaveLength(1)

    wrapper.unmount()
  })

  it('con soloReacciones, no se muestra la fila de acciones (responder/copiar)', () => {
    const wrapper = montar({ soloReacciones: true })

    expect(document.querySelector('.fila-acciones')).toBeNull()

    wrapper.unmount()
  })

  it('tocar el fondo oscurecido emite "cerrar"', () => {
    const wrapper = montar()

    document.querySelector('.fondo-oscurecido')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
    wrapper.unmount()
  })

  it('tocar dentro del menu no emite "cerrar"', () => {
    const wrapper = montar()

    document.querySelector('.message-action-bar')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('cerrar')).toBeUndefined()
    wrapper.unmount()
  })

  it('Escape emite "cerrar"', () => {
    const wrapper = montar()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
    wrapper.unmount()
  })

  it('se posiciona debajo del ancla cuando hay lugar, alineado a la izquierda por defecto', () => {
    const wrapper = montar()
    const el = document.querySelector('.message-action-bar') as HTMLElement

    expect(el.style.top).toBe(`${ANCLAJE.bottom + 8}px`)
    expect(el.style.left).toBe(`${ANCLAJE.left}px`)

    wrapper.unmount()
  })

  it('con alinearDerecha, se posiciona contra el borde derecho del ancla', () => {
    const wrapper = montar({ alinearDerecha: true })
    const el = document.querySelector('.message-action-bar') as HTMLElement

    expect(el.style.right).toBe(`${window.innerWidth - ANCLAJE.right}px`)

    wrapper.unmount()
  })
})
