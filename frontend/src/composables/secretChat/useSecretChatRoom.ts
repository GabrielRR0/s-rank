import { onUnmounted, ref } from 'vue'
import {
  crearMediaPointerEnvelope,
  crearMensajeEnvelope,
  crearVaultCopyUpdateEnvelope,
  crearVaultPointerEnvelope,
  EVENTO_MEDIA_POINTER,
  EVENTO_MENSAJE,
  EVENTO_VAULT_COPY_UPDATE,
  EVENTO_VAULT_POINTER,
  type MediaPointerEnvelope,
  type MensajeEnvelope,
  type VaultCopyUpdateEnvelope,
  type VaultPointerEnvelope,
} from '../../services/secretChat/chat.service'
import { fetchChatMedia, uploadChatMedia } from '../../services/secretChat/chatMedia.service'
import {
  base64UrlABytes,
  cifrarBinario,
  cifrarTexto,
  descifrarBinario,
  descifrarTexto,
} from '../../services/secretChat/crypto.service'
import { getPresenceKey, getRoomChannel, removeRoomChannel } from '../../services/secretChat/realtime.service'
import { useChatNotifications } from './useChatNotifications'
import { useEphemeralMessages } from './useEphemeralMessages'
import { useKickVote } from './useKickVote'
import { usePresenceCapacity } from './usePresenceCapacity'
import { useRealtimeAuth } from './useRealtimeAuth'
import { useTypingIndicator } from './useTypingIndicator'

export interface VaultPointer {
  vaultId: string
  maxCopias: number
  expiraEn: string
  copiasRestantes: number
  creadoEn: number
}

interface OpcionesSala {
  capacidadMaxima: number
  ttlSegundos: number
}

// Composable "raiz" de una sala: une el canal de Realtime (mensajeria +
// presence), el cifrado E2EE y el estado efimero local en un solo lugar.
// Nada de esto persiste en ningun servidor - ver README.md de este
// dominio y backend/README.md seccion 12.
export function useSecretChatRoom(roomId: string, clave: CryptoKey, apodo: string, opciones: OpcionesSala) {
  const canal = getRoomChannel(roomId)
  const miClavePresencia = getPresenceKey(roomId)
  const { mensajes, agregar } = useEphemeralMessages(opciones.ttlSegundos)
  const { notificarMensajeRecibido } = useChatNotifications()
  const { ocupantes, listaOcupantes, estado, conectar } = usePresenceCapacity(
    canal,
    opciones.capacidadMaxima,
    clave,
    miClavePresencia,
  )
  // Autoriza el canal privado (ver realtime.service.ts) - separado de
  // `estado` (que es sobre Presence/capacidad): estadoAuth solo importa
  // para decidir si hace falta mostrar ReverifyBanner.vue dentro de la
  // sala ya conectada, no bloquea el resto del flujo de conexion.
  const { estado: estadoAuth, iniciar: iniciarAuth } = useRealtimeAuth(roomId)
  const { escribiendo, notificarEscribiendo, detener: detenerEscribiendo } = useTypingIndicator(canal, clave, apodo)
  const { votoActivo, expulsado, iniciarVoto, votar } = useKickVote(canal, roomId, miClavePresencia, listaOcupantes)
  const vaults = ref<VaultPointer[]>([])

  async function manejarMensajeEntrante(envelope: MensajeEnvelope) {
    try {
      const autor = await descifrarTexto(clave, envelope.autor)
      const texto = await descifrarTexto(clave, envelope.texto)
      agregar({ id: envelope.id, autor, texto, propio: false, enviadoEn: envelope.enviadoEn, tipo: 'texto' })
      notificarMensajeRecibido(autor)
      // Si ya llego el mensaje, el aviso de "escribiendo" de esa persona
      // quedo obsoleto - no hace falta esperar a que expire solo (3s).
      detenerEscribiendo(autor)
    } catch {
      // Clave incorrecta (link mal copiado) o payload corrupto - se
      // descarta en silencio, no hay nada util que mostrar sobre un
      // mensaje que no se pudo descifrar.
    }
  }

  async function manejarMediaPointer(envelope: MediaPointerEnvelope) {
    try {
      const autor = await descifrarTexto(clave, envelope.autor)
      const item = await fetchChatMedia(envelope.mediaId)
      const datos = await descifrarBinario(clave, { ciphertext: base64UrlABytes(item.ciphertext), nonce: item.nonce })
      // Imagen usa un Blob URL para <img src>; audio guarda el ArrayBuffer
      // crudo, decodificado por AudioPlayer.vue via Web Audio API en vez de
      // un <audio src> nativo (ver useEphemeralMessages.ts).
      const esImagen = item.mimeType.startsWith('image/')
      agregar({
        id: envelope.id,
        autor,
        propio: false,
        enviadoEn: envelope.enviadoEn,
        tipo: 'media',
        mediaUrl: esImagen ? URL.createObjectURL(new Blob([datos], { type: item.mimeType })) : undefined,
        mediaDatos: esImagen ? undefined : datos,
        mimeType: item.mimeType,
      })
      notificarMensajeRecibido(autor)
    } catch {
      // Clave incorrecta, item ya vencido (raro pero posible si el TTL de
      // la sala corre mas rapido que la subida+bajada), o error de red - se
      // descarta en silencio, mismo criterio que manejarMensajeEntrante.
    }
  }

  function manejarVaultPointer(envelope: VaultPointerEnvelope) {
    if (vaults.value.some((vault) => vault.vaultId === envelope.vaultId)) return
    vaults.value.push({ ...envelope, copiasRestantes: envelope.maxCopias })
  }

  function manejarVaultCopyUpdate(envelope: VaultCopyUpdateEnvelope) {
    if (envelope.copiasRestantes <= 0) {
      vaults.value = vaults.value.filter((vault) => vault.vaultId !== envelope.vaultId)
      return
    }
    const vault = vaults.value.find((item) => item.vaultId === envelope.vaultId)
    if (vault) vault.copiasRestantes = envelope.copiasRestantes
  }

  if (canal) {
    canal
      .on('broadcast', { event: EVENTO_MENSAJE }, ({ payload }) => manejarMensajeEntrante(payload as MensajeEnvelope))
      .on('broadcast', { event: EVENTO_MEDIA_POINTER }, ({ payload }) =>
        manejarMediaPointer(payload as MediaPointerEnvelope),
      )
      .on('broadcast', { event: EVENTO_VAULT_POINTER }, ({ payload }) =>
        manejarVaultPointer(payload as VaultPointerEnvelope),
      )
      .on('broadcast', { event: EVENTO_VAULT_COPY_UPDATE }, ({ payload }) =>
        manejarVaultCopyUpdate(payload as VaultCopyUpdateEnvelope),
      )
  }

  // El access token debe quedar aplicado (setRealtimeAuth, dentro de
  // iniciarAuth) antes del primer .subscribe() (dentro de conectar) - pero
  // no antes de getRoomChannel()/los .on(...) de arriba, que son sincronos
  // y sin red. cifrarTexto corre en paralelo, es independiente.
  Promise.all([iniciarAuth(), cifrarTexto(clave, apodo)]).then(([, apodoCifrado]) => conectar(apodoCifrado))

  async function enviarMensaje(texto: string) {
    if (!canal || !texto.trim()) return
    const autorCifrado = await cifrarTexto(clave, apodo)
    const textoCifrado = await cifrarTexto(clave, texto)
    const envelope = crearMensajeEnvelope(autorCifrado, textoCifrado)
    await canal.send({ type: 'broadcast', event: EVENTO_MENSAJE, payload: envelope })
    // broadcast.self:false (ver realtime.service.ts) - el emisor no se
    // recibe a si mismo, hay que empujar el propio mensaje a mano.
    agregar({ id: envelope.id, autor: apodo, texto, propio: true, enviadoEn: envelope.enviadoEn, tipo: 'texto' })
  }

  async function enviarMedia(datos: ArrayBuffer, mimeType: string) {
    if (!canal) return
    const autorCifrado = await cifrarTexto(clave, apodo)
    const cifrado = await cifrarBinario(clave, datos)
    // room_id/ttl_seconds viajan tal cual el resto de la config de la sala
    // (query string, no secretos) - confiado del lado del cliente, mismo
    // criterio que cap/ttl en ChatRoomMain.vue: una sala sin contraseña no
    // tiene ninguna fila del lado del servidor contra la cual verificarlos.
    const { id: mediaId } = await uploadChatMedia({
      roomId,
      nonce: cifrado.nonce,
      mimeType,
      ttlSeconds: opciones.ttlSegundos,
      ciphertext: cifrado.ciphertext,
    })
    const envelope = crearMediaPointerEnvelope(mediaId, autorCifrado)
    await canal.send({ type: 'broadcast', event: EVENTO_MEDIA_POINTER, payload: envelope })
    // broadcast.self:false - mismo motivo que enviarMensaje(): el propio
    // bubble se arma directo desde `datos` (ya en memoria), sin volver a
    // pedirle el archivo al backend que recien se lo subimos. Misma
    // bifurcacion imagen/audio que manejarMediaPointer().
    const esImagen = mimeType.startsWith('image/')
    agregar({
      id: envelope.id,
      autor: apodo,
      propio: true,
      enviadoEn: envelope.enviadoEn,
      tipo: 'media',
      mediaUrl: esImagen ? URL.createObjectURL(new Blob([datos], { type: mimeType })) : undefined,
      mediaDatos: esImagen ? undefined : datos,
      mimeType,
    })
  }

  function compartirVault(vaultId: string, maxCopias: number, expiraEn: string) {
    if (!canal) return
    // Un solo envelope para ambos lados (igual que enviarMensaje/enviarMedia)
    // - asi `creadoEn` es el mismo tanto en la copia local como en la que
    // reciben los demas, sin generar dos timestamps distintos para "el mismo" evento.
    const envelope = crearVaultPointerEnvelope(vaultId, maxCopias, expiraEn)
    vaults.value.push({ ...envelope, copiasRestantes: maxCopias })
    canal.send({ type: 'broadcast', event: EVENTO_VAULT_POINTER, payload: envelope })
  }

  function notificarCopiaVault(vaultId: string, copiasRestantes: number) {
    manejarVaultCopyUpdate({ vaultId, copiasRestantes })
    canal?.send({
      type: 'broadcast',
      event: EVENTO_VAULT_COPY_UPDATE,
      payload: crearVaultCopyUpdateEnvelope(vaultId, copiasRestantes),
    })
  }

  onUnmounted(() => removeRoomChannel(roomId))

  return {
    mensajes,
    vaults,
    ocupantes,
    listaOcupantes,
    miClavePresencia,
    estado,
    estadoAuth,
    reintentarAuth: iniciarAuth,
    escribiendo,
    votoActivo,
    expulsado,
    enviarMensaje,
    enviarMedia,
    compartirVault,
    notificarCopiaVault,
    notificarEscribiendo,
    iniciarVoto,
    votar,
  }
}
