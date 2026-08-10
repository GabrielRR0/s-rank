import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { useLocale } from '../../i18n/useLocale'
import { useMediaAttachment } from './useMediaAttachment'

function montarMediaAttachment() {
  let composable!: ReturnType<typeof useMediaAttachment>
  mount(
    defineComponent({
      setup() {
        composable = useMediaAttachment()
        return () => h('div')
      },
    }),
  )
  return composable
}

function eventoConArchivo(archivo: File | null): Event {
  const input = document.createElement('input')
  input.type = 'file'
  Object.defineProperty(input, 'files', { value: archivo ? [archivo] : [], writable: false })
  return { target: input } as unknown as Event
}

describe('useMediaAttachment', () => {
  beforeEach(() => {
    useLocale().locale.value = 'es'
  })

  it('acepta una imagen valida y expone sus bytes + mimeType', async () => {
    const composable = montarMediaAttachment()
    const archivo = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' })

    await composable.seleccionarArchivo(eventoConArchivo(archivo))

    expect(composable.error.value).toBe('')
    expect(composable.archivoSeleccionado.value?.mimeType).toBe('image/png')
    expect(new Uint8Array(composable.archivoSeleccionado.value!.datos)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('rechaza un archivo que no es imagen (ej. un .exe renombrado o un pdf)', async () => {
    const composable = montarMediaAttachment()
    const archivo = new File([new Uint8Array([1])], 'documento.pdf', { type: 'application/pdf' })

    await composable.seleccionarArchivo(eventoConArchivo(archivo))

    expect(composable.error.value).toBe('Elige una imagen.')
    expect(composable.archivoSeleccionado.value).toBeNull()
  })

  it('rechaza un archivo cuyo tipo dice ser imagen pero en realidad es otra cosa disfrazada (mime spoofing) igual - solo mira el mime declarado por el navegador', async () => {
    // Documenta el limite real: esta capa confia en File.type (lo que
    // reporta el navegador/OS por extension), no abre el archivo para
    // verificar magic bytes - un .exe renombrado a .png con Content-Type
    // forzado pasaria este chequeo. La defensa real de contenido esta en
    // el backend (o no esta, ver README de sharedContent sobre "no es un
    // antivirus"). Este test documenta el comportamiento, no lo corrige.
    const composable = montarMediaAttachment()
    const archivoDisfrazado = new File([new Uint8Array([0x4d, 0x5a])], 'inocente.png', { type: 'image/png' })

    await composable.seleccionarArchivo(eventoConArchivo(archivoDisfrazado))

    expect(composable.archivoSeleccionado.value).not.toBeNull() // se acepta - el chequeo es solo de mime declarado
  })

  it('rechaza un archivo mas grande que el techo local (10MB)', async () => {
    const composable = montarMediaAttachment()
    const archivoGigante = new File([new Uint8Array(10_000_001)], 'grande.png', { type: 'image/png' })

    await composable.seleccionarArchivo(eventoConArchivo(archivoGigante))

    expect(composable.error.value).toBe('El archivo es demasiado grande.')
    expect(composable.archivoSeleccionado.value).toBeNull()
  })

  it('no seleccionar ningun archivo (cancelar el dialogo) no cambia nada ni tira error', async () => {
    const composable = montarMediaAttachment()

    await composable.seleccionarArchivo(eventoConArchivo(null))

    expect(composable.error.value).toBe('')
    expect(composable.archivoSeleccionado.value).toBeNull()
  })

  it('limpiar() resetea el archivo seleccionado y cualquier error', async () => {
    const composable = montarMediaAttachment()
    await composable.seleccionarArchivo(eventoConArchivo(new File([], 'x.pdf', { type: 'application/pdf' })))
    expect(composable.error.value).not.toBe('')

    composable.limpiar()

    expect(composable.error.value).toBe('')
    expect(composable.archivoSeleccionado.value).toBeNull()
  })

  it('reseleccionar el mismo archivo dos veces seguidas sigue funcionando (el input se resetea)', async () => {
    const composable = montarMediaAttachment()
    const archivo = new File([new Uint8Array([9])], 'foto.png', { type: 'image/png' })

    const evento1 = eventoConArchivo(archivo)
    await composable.seleccionarArchivo(evento1)
    expect((evento1.target as HTMLInputElement).value).toBe('')

    composable.limpiar()
    const evento2 = eventoConArchivo(archivo)
    await composable.seleccionarArchivo(evento2)

    expect(composable.archivoSeleccionado.value).not.toBeNull()
  })
})
