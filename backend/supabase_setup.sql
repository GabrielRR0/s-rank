-- S-Rank — script SQL completo para Supabase.
--
-- Correr UNA SOLA VEZ, de punta a punta: Supabase dashboard → SQL Editor →
-- New query → pegar todo este archivo → Run. No hace falta ir bloque por
-- bloque ni buscar SQL repartido en el README.
--
-- Cubre las dos misiones del proyecto:
--   Bloque 1: "Compartir algo sensible" (shared_content) - obligatorio siempre.
--   Bloques 2-4: "Chat secreto" (Cofre/Cápsula, autorización de Realtime,
--   imagen/audio) - solo hacen falta si vas a probar el chat. Correrlos
--   igual aunque no uses el chat es inofensivo (tablas de más, nada que
--   rompa "Compartir algo sensible").
--
-- Lo que este archivo NO cubre (son pasos manuales, no SQL):
--   1. Crear 3 buckets privados en Storage: s-rank-content, secret-vault-media,
--      secret-chat-media.
--   2. Si vas a usar el chat: Project Settings -> Realtime -> desactivar
--      "Allow public access" (si no, las policies de abajo quedan bypasseadas).
--   3. Completar backend/.env - ver backend/README.md sección 3 y 7 para el
--      detalle de cada variable (incluida SUPABASE_JWT_SECRET, solo para chat).

-- ============================================================
-- 1. Compartir algo sensible (sharedContent) - obligatorio siempre
-- ============================================================
create table shared_content (
  id uuid primary key,
  content_type text not null,
  content_text text,
  storage_path text,
  file_name text,
  file_name_nonce text,
  file_size integer,
  file_type text,
  password_hash text,
  encryption_nonce text,
  failed_password_attempts integer not null default 0,
  expires_at timestamptz not null,
  viewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table shared_content enable row level security;
-- Sin políticas públicas: el backend accede con la service role key
-- (bypassea RLS); el frontend nunca habla directo con Supabase.

-- ============================================================
-- 2. Cofre / Cápsula del chat secreto (secretVault) - solo si usás el chat
-- ============================================================
create table secret_vault_items (
  id uuid primary key,
  room_id text,
  ciphertext text,                 -- NULL en items de imagen/audio
  nonce text not null,
  max_copies integer not null,
  remaining_copies integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  content_type text not null default 'text' check (content_type in ('text', 'image', 'audio')),
  storage_path text,
  mime_type text
);
alter table secret_vault_items enable row level security;
-- Sin políticas públicas, mismo motivo que shared_content.

create or replace function decrement_vault_copies(item_id uuid)
returns setof secret_vault_items
language sql
as $$
  update secret_vault_items
  set remaining_copies = remaining_copies - 1
  where id = item_id and remaining_copies > 0 and expires_at > now()
  returning *;
$$;
-- No SECURITY DEFINER - se le quita ademas el permiso de ejecucion a los
-- roles publicos explicitamente, como defensa en profundidad sobre RLS.
revoke all on function decrement_vault_copies from public, anon, authenticated;

-- ============================================================
-- 3. Autorización de Realtime del chat (secretChatAuth) - solo chat
-- ============================================================
create table secret_chat_rooms (      -- solo salas con contraseña generan fila
  id uuid primary key,
  password_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table secret_chat_rooms enable row level security;

alter table realtime.messages enable row level security;

create policy "secret_chat_topic_select" on realtime.messages for select to authenticated using (
  extension in ('broadcast', 'presence') and (select realtime.topic()) = 'room:' || (auth.jwt() ->> 'room_id')
);
create policy "secret_chat_topic_insert" on realtime.messages for insert to authenticated with check (
  extension in ('broadcast', 'presence') and (select realtime.topic()) = 'room:' || (auth.jwt() ->> 'room_id')
);

-- ============================================================
-- 4. Imagen/audio del chat como mensaje normal (secretChatMedia) - solo chat
-- ============================================================
create table secret_chat_media_items (
  id uuid primary key,
  room_id text not null,
  storage_path text not null,
  nonce text not null,
  mime_type text not null,
  byte_size integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table secret_chat_media_items enable row level security;
