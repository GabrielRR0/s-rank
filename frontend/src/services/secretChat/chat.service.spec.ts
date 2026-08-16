import { describe, expect, it } from 'vitest'
import {
  crearKickVoteCastEnvelope,
  crearKickVoteResultEnvelope,
  crearKickVoteStartEnvelope,
  crearMediaPointerEnvelope,
  crearMensajeEnvelope,
  crearReaccionEnvelope,
  crearVaultCopyUpdateEnvelope,
  crearVaultPointerEnvelope,
  crearVistoEnvelope,
} from './chat.service'
import type { TextoCifrado } from './crypto.service'

const CIFRADO_FALSO: TextoCifrado = { ciphertext: 'x', nonce: 'y' }

describe('chat.service - factories de envelope', () => {
  it('crearMensajeEnvelope genera un id unico por mensaje', () => {
    const a = crearMensajeEnvelope(CIFRADO_FALSO, CIFRADO_FALSO)
    const b = crearMensajeEnvelope(CIFRADO_FALSO, CIFRADO_FALSO)

    expect(a.id).not.toBe(b.id)
    expect(a.autor).toBe(CIFRADO_FALSO)
    expect(a.texto).toBe(CIFRADO_FALSO)
    expect(typeof a.enviadoEn).toBe('number')
  })

  it('crearMediaPointerEnvelope genera un id unico y lleva el mediaId tal cual', () => {
    const a = crearMediaPointerEnvelope('media-123', CIFRADO_FALSO)
    const b = crearMediaPointerEnvelope('media-123', CIFRADO_FALSO)

    expect(a.id).not.toBe(b.id)
    expect(a.mediaId).toBe('media-123')
  })

  it('crearVaultPointerEnvelope lleva vaultId/maxCopias/expiraEn y agrega creadoEn', () => {
    const envelope = crearVaultPointerEnvelope('vault-1', 3, '2026-01-01T00:00:00Z')

    expect(envelope).toMatchObject({ vaultId: 'vault-1', maxCopias: 3, expiraEn: '2026-01-01T00:00:00Z' })
    expect(typeof envelope.creadoEn).toBe('number')
  })

  it('crearVaultCopyUpdateEnvelope es un mapeo directo sin campos extra', () => {
    expect(crearVaultCopyUpdateEnvelope('vault-1', 2)).toEqual({ vaultId: 'vault-1', copiasRestantes: 2 })
  })

  it('crearKickVoteStartEnvelope genera un votoId unico por votacion', () => {
    const a = crearKickVoteStartEnvelope('objetivo-1', 'iniciador-1')
    const b = crearKickVoteStartEnvelope('objetivo-1', 'iniciador-1')

    expect(a.votoId).not.toBe(b.votoId)
    expect(a.objetivoClavePresencia).toBe('objetivo-1')
    expect(a.iniciadorClavePresencia).toBe('iniciador-1')
  })

  it('crearKickVoteCastEnvelope y crearKickVoteResultEnvelope reusan el votoId dado (no generan uno nuevo)', () => {
    expect(crearKickVoteCastEnvelope('voto-x', 'votante-1')).toEqual({
      votoId: 'voto-x',
      votanteClavePresencia: 'votante-1',
    })
    expect(crearKickVoteResultEnvelope('voto-x', 'objetivo-1')).toEqual({
      votoId: 'voto-x',
      objetivoClavePresencia: 'objetivo-1',
    })
  })

  it('ningun envelope de mensaje/media/vault expone texto plano - solo TextoCifrado/ids/timestamps', () => {
    const envelope = crearMensajeEnvelope(CIFRADO_FALSO, CIFRADO_FALSO)
    const claves = Object.keys(envelope)
    expect(claves.sort()).toEqual(['autor', 'enviadoEn', 'id', 'respuestaA', 'texto'].sort())
    expect(envelope.respuestaA).toBeUndefined()
  })

  it('crearMensajeEnvelope incluye la vista previa de respuesta cuando se pasa', () => {
    const respuestaA = { mensajeId: 'm-1', autor: CIFRADO_FALSO, extracto: CIFRADO_FALSO }
    const envelope = crearMensajeEnvelope(CIFRADO_FALSO, CIFRADO_FALSO, respuestaA)

    expect(envelope.respuestaA).toEqual(respuestaA)
  })

  it('crearReaccionEnvelope es un mapeo directo, sin generar ids nuevos', () => {
    expect(crearReaccionEnvelope('m-1', 'presencia-1', CIFRADO_FALSO, 'agregar')).toEqual({
      mensajeId: 'm-1',
      autorClavePresencia: 'presencia-1',
      emoji: CIFRADO_FALSO,
      accion: 'agregar',
    })
  })

  it('crearVistoEnvelope es un mapeo directo, sin campos extra', () => {
    expect(crearVistoEnvelope('m-1', 'presencia-1')).toEqual({ mensajeId: 'm-1', autorClavePresencia: 'presencia-1' })
  })
})
