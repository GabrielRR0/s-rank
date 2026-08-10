import { describe, expect, it } from 'vitest'
import {
  base64UrlABytes,
  bytesABase64Url,
  cifrarBinario,
  cifrarTexto,
  descifrarBinario,
  descifrarTexto,
  exportarClaveParaUrl,
  generarClaveSala,
  importarClaveDesdeUrl,
} from './crypto.service'

// El unico archivo que toca SubtleCrypto - el corazon del cifrado E2E del
// chat secreto. Estos tests intentan ser "hostiles": no solo confirman que
// cifrar+descifrar funciona, sino que un atacante activo (tampering de
// ciphertext/nonce) o un usuario con un link roto no logran nada mas que un
// error explicito, nunca un dato incorrecto silencioso.

describe('crypto.service - texto', () => {
  it('cifrarTexto + descifrarTexto hacen roundtrip con la clave correcta', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, 'hola mundo secreto')

    const texto = await descifrarTexto(clave, cifrado)

    expect(texto).toBe('hola mundo secreto')
  })

  it('roundtrip con string vacio', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, '')

    expect(await descifrarTexto(clave, cifrado)).toBe('')
  })

  it('roundtrip con unicode/emoji', async () => {
    const clave = await generarClaveSala()
    const texto = 'ñoño 日本語 🔒🕵️‍♂️ café'
    const cifrado = await cifrarTexto(clave, texto)

    expect(await descifrarTexto(clave, cifrado)).toBe(texto)
  })

  it('roundtrip con un mensaje largo (cerca del limite de la app, 2000 caracteres)', async () => {
    const clave = await generarClaveSala()
    const texto = 'a'.repeat(2000)
    const cifrado = await cifrarTexto(clave, texto)

    expect(await descifrarTexto(clave, cifrado)).toBe(texto)
  })

  it('descifrar con la clave incorrecta falla en vez de devolver basura', async () => {
    const claveA = await generarClaveSala()
    const claveB = await generarClaveSala()
    const cifrado = await cifrarTexto(claveA, 'secreto de la sala A')

    await expect(descifrarTexto(claveB, cifrado)).rejects.toThrow()
  })

  it('un atacante que voltea UN bit del ciphertext rompe la verificacion GCM (tampering detectado)', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, 'mensaje original')
    const bytes = base64UrlABytes(cifrado.ciphertext)
    bytes[0] ^= 0b00000001 // voltea el bit menos significativo del primer byte
    const cifradoTamperado = { ...cifrado, ciphertext: bytesABase64Url(bytes) }

    await expect(descifrarTexto(clave, cifradoTamperado)).rejects.toThrow()
  })

  it('un atacante que altera el nonce tambien rompe la verificacion (no solo el ciphertext importa)', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarTexto(clave, 'mensaje original')
    const nonceBytes = base64UrlABytes(cifrado.nonce)
    nonceBytes[0] ^= 0b00000001
    const cifradoTamperado = { ...cifrado, nonce: bytesABase64Url(nonceBytes) }

    await expect(descifrarTexto(clave, cifradoTamperado)).rejects.toThrow()
  })
})

describe('crypto.service - binario (imagen/audio)', () => {
  it('cifrarBinario + descifrarBinario hacen roundtrip byte a byte', async () => {
    const clave = await generarClaveSala()
    const datos = new Uint8Array([1, 2, 3, 250, 251, 252, 0, 255]).buffer

    const cifrado = await cifrarBinario(clave, datos)
    const descifrado = await descifrarBinario(clave, cifrado)

    expect(new Uint8Array(descifrado)).toEqual(new Uint8Array(datos))
  })

  it('descifrarBinario con la clave incorrecta falla', async () => {
    const claveA = await generarClaveSala()
    const claveB = await generarClaveSala()
    const cifrado = await cifrarBinario(claveA, new Uint8Array([9, 9, 9]).buffer)

    await expect(descifrarBinario(claveB, cifrado)).rejects.toThrow()
  })

  it('tamperear un byte del ciphertext binario rompe la verificacion', async () => {
    const clave = await generarClaveSala()
    const cifrado = await cifrarBinario(clave, new Uint8Array([1, 2, 3, 4]).buffer)
    cifrado.ciphertext[0] ^= 0xff

    await expect(descifrarBinario(clave, cifrado)).rejects.toThrow()
  })
})

describe('crypto.service - clave por URL (fragmento #hash)', () => {
  it('exportarClaveParaUrl + importarClaveDesdeUrl producen una clave funcionalmente identica', async () => {
    const claveOriginal = await generarClaveSala()
    const urlKey = await exportarClaveParaUrl(claveOriginal)

    const claveImportada = await importarClaveDesdeUrl(urlKey)
    const cifrado = await cifrarTexto(claveOriginal, 'probando la clave importada')

    expect(await descifrarTexto(claveImportada, cifrado)).toBe('probando la clave importada')
  })

  it('la clave importada tambien puede cifrar (no es de solo lectura para el otro lado)', async () => {
    const claveOriginal = await generarClaveSala()
    const claveImportada = await importarClaveDesdeUrl(await exportarClaveParaUrl(claveOriginal))

    const cifrado = await cifrarTexto(claveImportada, 'respuesta desde el otro participante')

    expect(await descifrarTexto(claveOriginal, cifrado)).toBe('respuesta desde el otro participante')
  })

  it('importar un fragmento de URL corrupto/truncado (link mal copiado) rechaza en vez de crashear', async () => {
    const claveValida = await exportarClaveParaUrl(await generarClaveSala())
    const fragmentoTruncado = claveValida.slice(0, 10)

    await expect(importarClaveDesdeUrl(fragmentoTruncado)).rejects.toThrow()
  })

  it('importar basura que no es base64url valido rechaza', async () => {
    await expect(importarClaveDesdeUrl('###no-es-base64!!!')).rejects.toThrow()
  })
})

describe('crypto.service - bytesABase64Url/base64UrlABytes', () => {
  it('roundtrip exacto para una variedad de longitudes (cubre el padding de base64)', () => {
    for (const longitud of [0, 1, 2, 3, 4, 5, 16, 31, 32]) {
      const bytes = new Uint8Array(longitud).map((_, i) => i % 256)
      const codificado = bytesABase64Url(bytes)
      expect(base64UrlABytes(codificado)).toEqual(bytes)
    }
  })

  it('el charset resultante es URL-safe (sin +, / ni = de padding)', () => {
    // Bytes elegidos para forzar +/ en base64 estandar (0xfb 0xff en
    // distintas posiciones suele producir '+' o '/' en el alfabeto clasico).
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe, 0x3e, 0x3f, 0xff])
    const codificado = bytesABase64Url(bytes)

    expect(codificado).not.toMatch(/[+/=]/)
  })
})
