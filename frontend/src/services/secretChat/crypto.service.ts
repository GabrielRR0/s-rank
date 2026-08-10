// Unico archivo del frontend que toca SubtleCrypto. AES-GCM nativo del
// navegador en vez de crypto-js: cero dependencias nuevas para esto (ver
// README.md de este dominio), mismo primitivo que ya usa el backend
// (services/sharedContent/security/encryption.py), pero acá la clave nunca
// sale del navegador - ver useRoomKey.ts.
const NONCE_BYTES = 12

export interface TextoCifrado {
  ciphertext: string
  nonce: string
}

export function bytesABase64Url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Anotado como Uint8Array<ArrayBuffer> (no el generico ArrayBufferLike por
// defecto de esta version de TS/lib.dom): SubtleCrypto exige BufferSource,
// que solo acepta vistas respaldadas por un ArrayBuffer real, no cualquier
// ArrayBufferLike (ej. SharedArrayBuffer). Sin esta anotacion explicita, un
// `: Uint8Array` a secas se infiere como el generico mas amplio y
// crypto.subtle.encrypt/decrypt no lo acepta.
export function base64UrlABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = (4 - (base64url.length % 4)) % 4
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(relleno)
  const binario = atob(base64)
  return Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0))
}

export async function generarClaveSala(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

// La clave viaja en el fragmento de la URL (#hash): a diferencia del resto
// de la URL, el fragmento nunca se envia en un request HTTP (ni siquiera al
// mismo backend) - por eso es el unico lugar donde puede vivir sin que el
// servidor la vea jamas. Ver frontend/src/composables/secretChat/useRoomKey.ts.
export async function exportarClaveParaUrl(clave: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', clave)
  return bytesABase64Url(new Uint8Array(raw))
}

export async function importarClaveDesdeUrl(claveB64Url: string): Promise<CryptoKey> {
  const raw = base64UrlABytes(claveB64Url)
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function cifrarTexto(clave: CryptoKey, texto: string): Promise<TextoCifrado> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const codificado = new TextEncoder().encode(texto)
  const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, clave, codificado)
  return { ciphertext: bytesABase64Url(new Uint8Array(buffer)), nonce: bytesABase64Url(nonce) }
}

export async function descifrarTexto(clave: CryptoKey, cifrado: TextoCifrado): Promise<string> {
  const buffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlABytes(cifrado.nonce) },
    clave,
    base64UrlABytes(cifrado.ciphertext),
  )
  return new TextDecoder().decode(buffer)
}

// Analogo binario de TextoCifrado, para imagenes/audio (ver
// chatMedia.service.ts y vault.service.ts): el ciphertext queda en bytes
// crudos (no base64) porque va directo a un Blob para subirse como
// multipart - solo el nonce, chico, viaja como string.
export interface BinarioCifrado {
  ciphertext: Uint8Array<ArrayBuffer>
  nonce: string
}

export async function cifrarBinario(clave: CryptoKey, datos: ArrayBuffer): Promise<BinarioCifrado> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, clave, datos)
  return { ciphertext: new Uint8Array(buffer), nonce: bytesABase64Url(nonce) }
}

export async function descifrarBinario(clave: CryptoKey, cifrado: BinarioCifrado): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlABytes(cifrado.nonce) },
    clave,
    cifrado.ciphertext,
  )
}
