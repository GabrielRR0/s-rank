import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UploadZone from './UploadZone.vue'

function crearArchivo(nombre = 'foto.png', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], nombre, { type: 'image/png' })
}

describe('UploadZone', () => {
  it('no muestra el boton de quitar cuando no hay ningun archivo seleccionado', () => {
    const wrapper = mount(UploadZone, { props: { archivo: null } })

    expect(wrapper.find('.quitar').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('tiene-archivo')
  })

  it('muestra el nombre del archivo seleccionado', () => {
    const wrapper = mount(UploadZone, { props: { archivo: crearArchivo('foto.png') } })

    expect(wrapper.find('.texto-principal').text()).toBe('foto.png')
    expect(wrapper.classes()).toContain('tiene-archivo')
  })

  it('emite update:archivo con null al hacer click en el boton de quitar', async () => {
    const wrapper = mount(UploadZone, { props: { archivo: crearArchivo() } })

    await wrapper.find('.quitar').trigger('click')

    expect(wrapper.emitted('update:archivo')).toEqual([[null]])
  })
})
