import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExpirationSelector from './ExpirationSelector.vue'

describe('ExpirationSelector', () => {
  it('marca como activa la opcion que coincide con modelValue', () => {
    const wrapper = mount(ExpirationSelector, { props: { modelValue: 60 } })

    const opciones = wrapper.findAll('.opcion-expiracion')
    expect(opciones).toHaveLength(5)
    expect(opciones[1].classes()).toContain('activo')
    expect(opciones[0].classes()).not.toContain('activo')
  })

  it('emite update:modelValue con los minutos de la opcion clickeada', async () => {
    const wrapper = mount(ExpirationSelector, { props: { modelValue: 60 } })

    await wrapper.findAll('.opcion-expiracion')[3].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[4320]])
  })
})
