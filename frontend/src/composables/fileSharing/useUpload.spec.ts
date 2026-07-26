import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFileShare, createTextShare } from '../../services/fileSharing/sharing.service'
import { useUpload } from './useUpload'

vi.mock('../../services/fileSharing/sharing.service', () => ({
  createTextShare: vi.fn(),
  createFileShare: vi.fn(),
}))

const RESULTADO_MOCK = { id: 'abc', urlPath: '/s/abc', expiresAt: '2026-01-01T00:00:00Z' }

describe('useUpload', () => {
  beforeEach(() => {
    vi.mocked(createTextShare).mockReset()
    vi.mocked(createFileShare).mockReset()
  })

  it('no llama al servicio si el texto esta vacio', async () => {
    const { crear, errores } = useUpload()

    await crear()

    expect(errores.value.length).toBeGreaterThan(0)
    expect(createTextShare).not.toHaveBeenCalled()
  })

  it('crea un share de texto con los datos del formulario', async () => {
    vi.mocked(createTextShare).mockResolvedValue(RESULTADO_MOCK)
    const { texto, expiracionMinutos, crear, resultado } = useUpload()
    texto.value = 'hola mundo'
    expiracionMinutos.value = 1440

    await crear()

    expect(createTextShare).toHaveBeenCalledWith('hola mundo', null, 1440)
    expect(resultado.value?.id).toBe('abc')
  })

  it('no manda contraseña si el toggle esta activo pero el campo esta vacio', async () => {
    vi.mocked(createTextShare).mockResolvedValue(RESULTADO_MOCK)
    const { texto, protegerConPassword, password, crear } = useUpload()
    texto.value = 'hola'
    protegerConPassword.value = true
    password.value = ''

    await crear()

    expect(createTextShare).toHaveBeenCalledWith('hola', null, 60)
  })

  it('manda la contraseña cuando el toggle esta activo y tiene texto', async () => {
    vi.mocked(createTextShare).mockResolvedValue(RESULTADO_MOCK)
    const { texto, protegerConPassword, password, crear } = useUpload()
    texto.value = 'hola'
    protegerConPassword.value = true
    password.value = 'secreta123'

    await crear()

    expect(createTextShare).toHaveBeenCalledWith('hola', 'secreta123', 60)
  })

  it('crea un share de archivo cuando el modo es file', async () => {
    vi.mocked(createFileShare).mockResolvedValue(RESULTADO_MOCK)
    const { modo, archivo, elegirArchivo, crear } = useUpload()
    modo.value = 'file'
    elegirArchivo(new File([new Uint8Array(10)], 'nota.txt'))

    await crear()

    expect(createFileShare).toHaveBeenCalledWith(archivo.value, null, 60)
  })

  it('guarda el mensaje de error si el servicio falla', async () => {
    vi.mocked(createTextShare).mockRejectedValue(new Error('el servidor no responde'))
    const { texto, crear, errorCreacion, resultado } = useUpload()
    texto.value = 'hola'

    await crear()

    expect(errorCreacion.value).toBe('el servidor no responde')
    expect(resultado.value).toBeNull()
  })

  it('reiniciar limpia el resultado y vuelve al estado inicial', async () => {
    vi.mocked(createTextShare).mockResolvedValue(RESULTADO_MOCK)
    const { texto, crear, resultado, reiniciar } = useUpload()
    texto.value = 'hola'
    await crear()

    reiniciar()

    expect(resultado.value).toBeNull()
    expect(texto.value).toBe('')
  })
})
