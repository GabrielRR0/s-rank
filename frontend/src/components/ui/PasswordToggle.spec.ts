import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PasswordToggle from './PasswordToggle.vue'

describe('PasswordToggle', () => {
  it('no muestra el campo de contraseña cuando esta desactivado', () => {
    const wrapper = mount(PasswordToggle, { props: { activo: false, password: '' } })

    expect(wrapper.find('.campo-password').exists()).toBe(false)
  })

  it('muestra el campo de contraseña cuando esta activado', () => {
    const wrapper = mount(PasswordToggle, { props: { activo: true, password: '' } })

    expect(wrapper.find('.campo-password').exists()).toBe(true)
  })

  it('emite update:activo al hacer click en el switch', async () => {
    const wrapper = mount(PasswordToggle, { props: { activo: false, password: '' } })

    await wrapper.find('.switch').trigger('click')

    expect(wrapper.emitted('update:activo')).toEqual([[true]])
  })

  it('emite update:password al escribir en el campo', async () => {
    const wrapper = mount(PasswordToggle, { props: { activo: true, password: '' } })

    await wrapper.find('.campo-password').setValue('secreta123')

    expect(wrapper.emitted('update:password')).toEqual([['secreta123']])
  })
})
