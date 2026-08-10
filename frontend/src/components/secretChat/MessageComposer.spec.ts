import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocale } from '../../i18n/useLocale'
import { MAX_MESSAGE_LENGTH } from '../../utils/validators/validateChatInput'
import MessageComposer from './MessageComposer.vue'

function montar() {
  return mount(MessageComposer, { props: { clave: {} as CryptoKey, roomId: 'sala-1' } })
}

describe('MessageComposer', () => {
  beforeEach(() => {
    useLocale().locale.value = 'es'
  })

  it('el boton de enviar esta deshabilitado sin texto', () => {
    const wrapper = montar()

    expect(wrapper.find('.boton-enviar').attributes('disabled')).toBeDefined()
  })

  it('escribir texto habilita el boton y enviar emite "enviar" con el texto, luego limpia el campo', async () => {
    const wrapper = montar()
    const input = wrapper.find('.campo-mensaje')

    await input.setValue('hola secreto')
    expect(wrapper.find('.boton-enviar').attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('enviar')).toEqual([['hola secreto']])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('un mensaje de solo espacios no se envia (submit no hace nada)', async () => {
    const wrapper = montar()
    await wrapper.find('.campo-mensaje').setValue('     ')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('enviar')).toBeUndefined()
  })

  it('escribir contenido no vacio emite "escribiendo"; borrar el campo no lo vuelve a emitir', async () => {
    const wrapper = montar()
    const input = wrapper.find('.campo-mensaje')

    await input.setValue('h')
    expect(wrapper.emitted('escribiendo')).toHaveLength(1)

    await input.setValue('')
    expect(wrapper.emitted('escribiendo')).toHaveLength(1) // no un segundo evento al vaciar
  })

  it('un mensaje que excede MAX_MESSAGE_LENGTH (bypaseando el maxlength del input, ej. pegado/cliente modificado) muestra error y no emite', async () => {
    const wrapper = montar()
    const input = wrapper.find('.campo-mensaje')
    // setValue respeta maxlength del input real del navegador, pero jsdom
    // no lo aplica automaticamente en todos los casos - fuerza el valor
    // directo para simular un pegado que sortea el limite del atributo.
    await input.setValue('a'.repeat(MAX_MESSAGE_LENGTH + 1))

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('enviar')).toBeUndefined()
    expect(wrapper.find('.error-mensaje').text()).toBe('El mensaje es demasiado largo.')
  })

  it('seleccionar una imagen valida reemplaza el formulario por MediaSendPrompt', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    const wrapper = montar()
    const archivo = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [archivo] })

    await input.trigger('change')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0)) // seleccionarArchivo es async (archivo.arrayBuffer())
    await wrapper.vm.$nextTick()

    expect(wrapper.find('form').exists()).toBe(false)
    vi.restoreAllMocks()
  })

  it('seleccionar un archivo que no es imagen muestra el error de useMediaAttachment debajo del formulario', async () => {
    const wrapper = montar()
    const archivo = new File([new Uint8Array([1])], 'doc.pdf', { type: 'application/pdf' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [archivo] })

    await input.trigger('change')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('form').exists()).toBe(true) // sigue en el formulario normal, no paso a MediaSendPrompt
    expect(wrapper.find('.error-mensaje').text()).toBe('Elige una imagen.')
  })
})
