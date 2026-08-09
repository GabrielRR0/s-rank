import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

// Primer uso de Supabase directo desde el frontend en este proyecto (hasta
// ahora solo el backend le hablaba a Supabase, con la service_role key - ver
// backend/README.md seccion 8). Excepcion deliberada: la mensajeria del
// chat necesita Realtime Broadcast, que solo se puede usar desde el
// navegador. La anon key es publica por diseno (protegida por RLS del lado
// de las tablas que si importan, ver backend/README.md seccion 12) - nunca
// se usa acá la service_role key.
let clienteCache: SupabaseClient | null | undefined

function getClient(): SupabaseClient | null {
  if (clienteCache !== undefined) return clienteCache
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  clienteCache = url && anonKey ? createClient(url, anonKey) : null
  return clienteCache
}

// Autoriza al cliente a usar canales privados (ver `private: true` mas
// abajo) - el access token lo emite el backend via
// services/secretChat/realtimeAuth.service.ts, nunca se genera aca. Sobre
// una conexion ya abierta, llamar esto de nuevo actualiza la autorizacion
// cacheada sin reconectar el socket (ver useRealtimeAuth.ts, que lo llama
// periodicamente para refrescar).
export async function setRealtimeAuth(token: string): Promise<void> {
  await getClient()?.realtime.setAuth(token)
}

// Un canal por sala, reutilizado mientras dure la pestaña - evita
// reconectar si varios composables de la misma sala piden el canal.
const canalesPorSala = new Map<string, RealtimeChannel>()
// La clave de presencia de esta pestaña para cada sala - generada junto con
// el canal (ver mas abajo) pero necesita quedar accesible por fuera para que
// usePresenceCapacity.ts sepa "cual fila de la lista soy yo" y useKickVote.ts
// sepa contra que clave comparar un objetivo de expulsion.
const clavesPresenciaPorSala = new Map<string, string>()

export function getRoomChannel(roomId: string): RealtimeChannel | null {
  const client = getClient()
  if (!client) return null

  let canal = canalesPorSala.get(roomId)
  if (!canal) {
    const clavePresencia = crypto.randomUUID()
    canal = client.channel(`room:${roomId}`, {
      config: {
        // self:false - el emisor de un broadcast nunca se lo recibe de
        // vuelta, quien envia debe empujar el mensaje a su propio estado
        // local apenas el envio es exitoso (ver useSecretChatRoom.ts).
        broadcast: { self: false, ack: false },
        // Clave de presencia aleatoria por pestaña, no el apodo (que no es
        // unico) - es lo que Supabase usa para contar/deduplicar
        // participantes (ver usePresenceCapacity.ts).
        presence: { key: clavePresencia },
        // Canal privado: Supabase exige un token valido (setRealtimeAuth,
        // arriba) autorizado por politicas RLS sobre realtime.messages
        // antes de dejar usar Broadcast/Presence en este topic - ver
        // backend/README.md seccion 14. Sin esto, la anon key sola
        // alcanzaria para usar cualquier canal.
        private: true,
      },
    })
    canalesPorSala.set(roomId, canal)
    clavesPresenciaPorSala.set(roomId, clavePresencia)
  }
  return canal
}

export function getPresenceKey(roomId: string): string | null {
  return clavesPresenciaPorSala.get(roomId) ?? null
}

export function removeRoomChannel(roomId: string): void {
  const client = getClient()
  const canal = canalesPorSala.get(roomId)
  if (client && canal) client.removeChannel(canal)
  canalesPorSala.delete(roomId)
  clavesPresenciaPorSala.delete(roomId)
}
