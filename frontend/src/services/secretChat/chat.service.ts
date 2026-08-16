import type { TextoCifrado } from './crypto.service'

// Los tipos de evento que viajan por Supabase Realtime Broadcast en el
// topic `room:<roomId>` (ver realtime.service.ts). Todo lo que no sea un
// numero/id ya viene cifrado con la clave de la sala (TextoCifrado) - el
// relay de Supabase nunca ve texto plano, ni siquiera apodos.
export const EVENTO_MENSAJE = 'mensaje'
export const EVENTO_VAULT_POINTER = 'vault-pointer'
export const EVENTO_VAULT_COPY_UPDATE = 'vault-copy-update'
// Payload = TextoCifrado del apodo de quien esta escribiendo - no necesita
// un envelope propio, ver useTypingIndicator.ts.
export const EVENTO_ESCRIBIENDO = 'escribiendo'
// Expulsion por voto de mayoria (ver useKickVote.ts) - a diferencia de todo
// lo demas de este archivo, estos payloads NO llevan nada cifrado: son solo
// claves de presencia (identificadores de conexion aleatorios, no secretos)
// y contadores, nada que el relay de Supabase pueda usar para leer el
// contenido de la sala.
export const EVENTO_VOTO_EXPULSION_INICIAR = 'kick-vote-start'
export const EVENTO_VOTO_EXPULSION_VOTAR = 'kick-vote-cast'
export const EVENTO_VOTO_EXPULSION_EXPULSADO = 'kick-vote-kicked'
// Apunta a un item ya subido al backend (POST /api/secret-chat-media) - los
// bytes en si nunca viajan por el broadcast, solo el id para que cada
// participante los pida via chatMedia.service.ts. nonce/mime_type no van
// aca: ya viajan en la respuesta del GET, que de todos modos hace falta
// pedir para bajar el contenido (ver useSecretChatRoom.manejarMediaPointer).
export const EVENTO_MEDIA_POINTER = 'media-pointer'

// Vista previa de a que mensaje se responde (ver MessageComposer.vue/
// MessageBubble.vue) - limitado a mensajes de texto por ahora, no a
// imagen/audio (extenderlo a media queda como mejora futura, no bloquea nada
// de esto). mensajeId va en claro (como vaultId - solo un id); autor/extracto
// son contenido real, cifrados igual que el resto del mensaje.
export interface RespuestaPreview {
  mensajeId: string
  autor: TextoCifrado
  extracto: TextoCifrado
}

export interface MensajeEnvelope {
  id: string
  autor: TextoCifrado
  texto: TextoCifrado
  enviadoEn: number
  respuestaA?: RespuestaPreview
}

// Apunta a un item ya creado en el backend (POST /api/secret-vault) - el
// contenido en si nunca viaja por el broadcast, solo el id para que cada
// participante lo pida via vault.service.ts. `creadoEn` no es para TTL (eso
// ya lo maneja `expiraEn`/el backend) - es solo para poder intercalar el
// Cofre en el orden cronologico correcto junto a los mensajes normales (ver
// MessageList.vue), igual que `enviadoEn` en MensajeEnvelope.
export interface VaultPointerEnvelope {
  vaultId: string
  maxCopias: number
  expiraEn: string
  creadoEn: number
}

export interface VaultCopyUpdateEnvelope {
  vaultId: string
  copiasRestantes: number
}

export function crearMensajeEnvelope(
  autor: TextoCifrado,
  texto: TextoCifrado,
  respuestaA?: RespuestaPreview,
): MensajeEnvelope {
  return { id: crypto.randomUUID(), autor, texto, enviadoEn: Date.now(), respuestaA }
}

export function crearVaultPointerEnvelope(vaultId: string, maxCopias: number, expiraEn: string): VaultPointerEnvelope {
  return { vaultId, maxCopias, expiraEn, creadoEn: Date.now() }
}

export function crearVaultCopyUpdateEnvelope(vaultId: string, copiasRestantes: number): VaultCopyUpdateEnvelope {
  return { vaultId, copiasRestantes }
}

export interface KickVoteStartEnvelope {
  votoId: string
  objetivoClavePresencia: string
  iniciadorClavePresencia: string
  iniciadoEn: number
}

export interface KickVoteCastEnvelope {
  votoId: string
  votanteClavePresencia: string
}

export interface KickVoteResultEnvelope {
  votoId: string
  objetivoClavePresencia: string
}

export function crearKickVoteStartEnvelope(
  objetivoClavePresencia: string,
  iniciadorClavePresencia: string,
): KickVoteStartEnvelope {
  return { votoId: crypto.randomUUID(), objetivoClavePresencia, iniciadorClavePresencia, iniciadoEn: Date.now() }
}

export function crearKickVoteCastEnvelope(votoId: string, votanteClavePresencia: string): KickVoteCastEnvelope {
  return { votoId, votanteClavePresencia }
}

export function crearKickVoteResultEnvelope(votoId: string, objetivoClavePresencia: string): KickVoteResultEnvelope {
  return { votoId, objetivoClavePresencia }
}

export interface MediaPointerEnvelope {
  id: string
  mediaId: string
  autor: TextoCifrado
  enviadoEn: number
}

export function crearMediaPointerEnvelope(mediaId: string, autor: TextoCifrado): MediaPointerEnvelope {
  return { id: crypto.randomUUID(), mediaId, autor, enviadoEn: Date.now() }
}

// Reaccion con emoji (set fijo, ver MessageActionBar.vue) - 'agregar'/'quitar'
// en vez de dos eventos separados: tocar el mismo emoji ya puesto lo retira,
// misma logica de toggle en useMessageReactions.ts.
export const EVENTO_REACCION = 'reaccion'

export interface ReaccionEnvelope {
  mensajeId: string // claro, como vaultId - solo un id, no contenido
  autorClavePresencia: string // claro, como en kick-vote - no es secreto
  emoji: TextoCifrado // contenido -> cifrado, igual que `texto`
  accion: 'agregar' | 'quitar'
}

export function crearReaccionEnvelope(
  mensajeId: string,
  autorClavePresencia: string,
  emoji: TextoCifrado,
  accion: 'agregar' | 'quitar',
): ReaccionEnvelope {
  return { mensajeId, autorClavePresencia, emoji, accion }
}

// "Visto": un solo ping simple (alguien mas desencripto el mensaje), sin
// distinguir entregado/leido ni trackear por persona - los TTLs cortos de
// este chat (5-60s) hacen que un tally completo tipo WhatsApp valga poco
// por su complejidad (ver useMessageSeen.ts).
export const EVENTO_MENSAJE_VISTO = 'mensaje-visto'

export interface VistoEnvelope {
  mensajeId: string
  autorClavePresencia: string
}

export function crearVistoEnvelope(mensajeId: string, autorClavePresencia: string): VistoEnvelope {
  return { mensajeId, autorClavePresencia }
}
