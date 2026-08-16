import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { ahora, useTickingClock } from './useTickingClock'

function montarConsumidor() {
  return mount(
    defineComponent({
      setup() {
        useTickingClock()
        return () => h('div')
      },
    }),
  )
}

describe('useTickingClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('actualiza ahora cada segundo mientras hay un consumidor montado', () => {
    const inicio = ahora.value
    const wrapper = montarConsumidor()

    vi.advanceTimersByTime(3000)

    expect(ahora.value).toBeGreaterThan(inicio)
    wrapper.unmount()
  })

  it('detiene el interval al desmontar el consumidor', () => {
    const wrapper = montarConsumidor()
    wrapper.unmount()
    const valorTrasDesmontar = ahora.value

    vi.advanceTimersByTime(5000)

    expect(ahora.value).toBe(valorTrasDesmontar)
  })
})
