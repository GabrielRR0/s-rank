import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { fetchShareStatus, revealShare, ShareRevealError } from '../../services/fileSharing/sharing.service'
import { useOneTimeView } from './useOneTimeView'

vi.mock('../../services/fileSharing/sharing.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/fileSharing/sharing.service')>()
  return { ...actual, fetchShareStatus: vi.fn(), revealShare: vi.fn() }
})

// useOneTimeView dispara la consulta de estado en onMounted, asi que hay que
// montarlo dentro de un componente minimo (mismo patron que
// useContractWizard.spec.ts en contract-generator).
function montarComposable(shareId: string) {
  let composable!: ReturnType<typeof useOneTimeView>
  mount(
    defineComponent({
      setup() {
        composable = useOneTimeView(shareId)
        return () => h('div')
      },
    }),
  )
  return composable
}

describe('useOneTimeView', () => {
  beforeEach(() => {
    vi.mocked(fetchShareStatus).mockReset()
    vi.mocked(revealShare).mockReset()
  })

  it('pasa a no-disponible si el share no existe', async () => {
    vi.mocked(fetchShareStatus).mockResolvedValue({
      exists: false,
      requiresPassword: false,
      contentType: null,
      fileName: null,
    })

    const composable = montarComposable('abc')

    await vi.waitFor(() => expect(composable.estado.value).toBe('no-disponible'))
  })

  it('pasa a pide-password si el share existe y requiere contraseña', async () => {
    vi.mocked(fetchShareStatus).mockResolvedValue({
      exists: true,
      requiresPassword: true,
      contentType: 'text',
      fileName: null,
    })

    const composable = montarComposable('abc')

    await vi.waitFor(() => expect(composable.estado.value).toBe('pide-password'))
  })

  it('pasa a listo-para-ver si el share existe sin contraseña', async () => {
    vi.mocked(fetchShareStatus).mockResolvedValue({
      exists: true,
      requiresPassword: false,
      contentType: 'text',
      fileName: null,
    })

    const composable = montarComposable('abc')

    await vi.waitFor(() => expect(composable.estado.value).toBe('listo-para-ver'))
  })

  it('revelar con exito pasa a revelado con el contenido', async () => {
    vi.mocked(fetchShareStatus).mockResolvedValue({
      exists: true,
      requiresPassword: false,
      contentType: 'text',
      fileName: null,
    })
    vi.mocked(revealShare).mockResolvedValue({ contentType: 'text', text: 'secreto' })

    const composable = montarComposable('abc')
    await vi.waitFor(() => expect(composable.estado.value).toBe('listo-para-ver'))

    await composable.revelar()

    expect(composable.estado.value).toBe('revelado')
    expect(composable.contenido.value).toEqual({ contentType: 'text', text: 'secreto' })
  })

  it('revelar con contraseña incorrecta vuelve a pide-password con el mensaje de error', async () => {
    vi.mocked(fetchShareStatus).mockResolvedValue({
      exists: true,
      requiresPassword: true,
      contentType: 'text',
      fileName: null,
    })
    vi.mocked(revealShare).mockRejectedValue(new ShareRevealError('Contraseña incorrecta.', 401))

    const composable = montarComposable('abc')
    await vi.waitFor(() => expect(composable.estado.value).toBe('pide-password'))

    await composable.revelar()

    expect(composable.estado.value).toBe('pide-password')
    expect(composable.errorPassword.value).toBe('Contraseña incorrecta.')
  })

  it('revelar sobre un share vencido o ya visto pasa a no-disponible', async () => {
    vi.mocked(fetchShareStatus).mockResolvedValue({
      exists: true,
      requiresPassword: false,
      contentType: 'text',
      fileName: null,
    })
    vi.mocked(revealShare).mockRejectedValue(new ShareRevealError('Expirado.', 410))

    const composable = montarComposable('abc')
    await vi.waitFor(() => expect(composable.estado.value).toBe('listo-para-ver'))

    await composable.revelar()

    expect(composable.estado.value).toBe('no-disponible')
  })
})
