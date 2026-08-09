import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useOneTimeView } from '../../composables/fileSharing/useOneTimeView'
import AudioPlayer from '../ui/AudioPlayer.vue'
import ViewContent from './ViewContent.vue'

vi.mock('../../composables/fileSharing/useOneTimeView', () => ({
  useOneTimeView: vi.fn(),
}))

function mockUseOneTimeView(
  overrides: Partial<{
    estado: string
    requierePassword: boolean
    password: string
    errorPassword: string
    contenido: unknown
    revelar: () => void
  }> = {},
) {
  const estado = ref(overrides.estado ?? 'cargando')
  const requierePassword = ref(overrides.requierePassword ?? false)
  const password = ref(overrides.password ?? '')
  const errorPassword = ref(overrides.errorPassword ?? '')
  const contenido = ref(overrides.contenido ?? null)
  const revelar = overrides.revelar ?? vi.fn()

  vi.mocked(useOneTimeView).mockReturnValue({ estado, requierePassword, password, errorPassword, contenido, revelar } as never)

  return { estado, requierePassword, password, errorPassword, contenido, revelar }
}

describe('ViewContent', () => {
  beforeEach(() => {
    vi.mocked(useOneTimeView).mockReset()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra el estado de carga, sin la invitacion a crear un enlace propio', () => {
    mockUseOneTimeView({ estado: 'cargando' })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('.estado-texto').exists()).toBe(true)
    expect(wrapper.find('.formulario-revelar').exists()).toBe(false)
    expect(wrapper.find('.crear-propio').exists()).toBe(false)
  })

  it('muestra el mensaje de enlace no disponible, con la invitacion a crear un enlace propio', () => {
    mockUseOneTimeView({ estado: 'no-disponible' })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('h2').exists()).toBe(true)
    expect(wrapper.find('.formulario-revelar').exists()).toBe(false)
    expect(wrapper.find('.crear-propio').exists()).toBe(true)
    expect(wrapper.find('.crear-propio-enlace').attributes('href')).toBe('/')
  })

  it('muestra el campo de contraseña cuando el share la requiere, sin la invitacion a crear un enlace propio todavia', () => {
    mockUseOneTimeView({ estado: 'pide-password', requierePassword: true })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('#campo-password-visor').exists()).toBe(true)
    expect(wrapper.find('.crear-propio').exists()).toBe(false)
  })

  it('no muestra el campo de contraseña cuando el share no la requiere', () => {
    mockUseOneTimeView({ estado: 'listo-para-ver', requierePassword: false })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('#campo-password-visor').exists()).toBe(false)
    expect(wrapper.find('.formulario-revelar').exists()).toBe(true)
  })

  it('llama a revelar al enviar el formulario', async () => {
    const { revelar } = mockUseOneTimeView({ estado: 'listo-para-ver' })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })
    await wrapper.find('.formulario-revelar').trigger('submit')

    expect(revelar).toHaveBeenCalled()
  })

  it('muestra el mensaje de error cuando la contraseña fue incorrecta', () => {
    mockUseOneTimeView({ estado: 'pide-password', requierePassword: true, errorPassword: 'Contraseña incorrecta.' })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('.base-alert').exists()).toBe(true)
  })

  it('deshabilita el boton mientras se esta revelando el contenido', () => {
    mockUseOneTimeView({ estado: 'revelando' })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('button[disabled]').exists()).toBe(true)
  })

  it('muestra el texto revelado junto con la invitacion a crear un enlace propio', () => {
    mockUseOneTimeView({ estado: 'revelado', contenido: { contentType: 'text', text: 'secreto' } })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('.texto-revelado').text()).toBe('secreto')
    expect(wrapper.find('.crear-propio').exists()).toBe(true)
  })

  it('muestra una imagen inline, endurecida contra guardar/arrastrar, cuando el archivo revelado es una imagen', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    mockUseOneTimeView({ estado: 'revelado', contenido: { contentType: 'file', blob, fileName: 'foto.png' } })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('.imagen-revelada').exists()).toBe(true)
    expect(wrapper.find('.imagen-revelada').attributes('draggable')).toBe('false')
    expect(wrapper.find('.descarga-enlace').exists()).toBe(false)
  })

  it('muestra el reproductor propio (sin <audio> nativo ni descarga) cuando el archivo revelado es audio', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
    mockUseOneTimeView({ estado: 'revelado', contenido: { contentType: 'file', blob, fileName: 'nota.webm' } })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })
    await flushPromises()

    expect(wrapper.findComponent(AudioPlayer).exists()).toBe(true)
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.find('.descarga-enlace').exists()).toBe(false)
  })

  it('muestra un enlace de descarga cuando el archivo revelado no es una imagen', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' })
    mockUseOneTimeView({ estado: 'revelado', contenido: { contentType: 'file', blob, fileName: 'documento.pdf' } })

    const wrapper = mount(ViewContent, { props: { shareId: 'abc' } })

    expect(wrapper.find('.descarga-enlace').exists()).toBe(true)
    expect(wrapper.find('.descarga-enlace').attributes('download')).toBe('documento.pdf')
    expect(wrapper.find('.imagen-revelada').exists()).toBe(false)
  })
})
