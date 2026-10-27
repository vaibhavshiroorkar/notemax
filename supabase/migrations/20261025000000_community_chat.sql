-- Talking in the community: direct messages between two people, comments
-- (with replies) under posts, and topic rooms anyone can join. Everyone needs
-- a profile to write. People can block someone, which stops their messages
-- and their comments under the blocker's posts. Triggers cap how fast anyone
-- can write and how many rooms they can make, so one account cannot flood.
--
-- Safe to run again: everything is created only when missing, and triggers
-- and policies are replaced.

create table if not exists public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);

create index if not exists messages_pair on public.messages (least(sender, recipient), greatest(sender, recipient), created_at desc);
create index if not exists messages_recipient on public.messages (recipient, read_at);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author uuid not null references public.profiles (id) on delete cascade,
  -- A reply names the comment it answers. Replies to replies stay one level in.
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists comments_post on public.comments (post_id, created_at);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique check (slug::text ~ '^[a-z0-9-]{2,32}$'),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists rooms_creator on public.rooms (created_by, created_at desc);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists room_messages_room on public.room_messages (room_id, created_at desc);

-- Whether `owner` blocked `other`. Policies need this for other people's blocks,
-- which row security hides from the person writing, so it runs as the owner.
create or replace function public.community_blocked(owner uuid, other uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (select 1 from public.blocks where blocker = owner and blocked = other);
$$;

revoke all on function public.community_blocked(uuid, uuid) from public;
grant execute on function public.community_blocked(uuid, uuid) to authenticated;

-- Times come from the server, so nobody can date a message into the future.
create or replace function public.community_written_now()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists messages_now on public.messages;
drop trigger if exists comments_now on public.comments;
drop trigger if exists rooms_now on public.rooms;
drop trigger if exists room_messages_now on public.room_messages;
create trigger messages_now before insert on public.messages for each row execute function public.community_written_now();
create trigger comments_now before insert on public.comments for each row execute function public.community_written_now();
create trigger rooms_now before insert on public.rooms for each row execute function public.community_written_now();
create trigger room_messages_now before insert on public.room_messages for each row execute function public.community_written_now();

-- At most 20 messages, comments and room messages together per minute per person.
create or replace function public.community_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  writer uuid := auth.uid();
  recent integer;
begin
  select (select count(*) from public.messages where sender = writer and created_at > now() - interval '1 minute')
       + (select count(*) from public.comments where author = writer and created_at > now() - interval '1 minute')
       + (select count(*) from public.room_messages where author = writer and created_at > now() - interval '1 minute')
    into recent;
  if recent >= 20 then
    raise exception 'too many messages, wait a minute' using errcode = 'P0001', hint = 'rate_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_rate on public.messages;
drop trigger if exists comments_rate on public.comments;
drop trigger if exists room_messages_rate on public.room_messages;
create trigger messages_rate before insert on public.messages for each row execute function public.community_rate_limit();
create trigger comments_rate before insert on public.comments for each row execute function public.community_rate_limit();
create trigger room_messages_rate before insert on public.room_messages for each row execute function public.community_rate_limit();

-- At most three new rooms a day per person.
create or replace function public.community_room_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (select count(*) from public.rooms where created_by = auth.uid() and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too many new rooms, try again tomorrow' using errcode = 'P0001', hint = 'room_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_rate on public.rooms;
create trigger rooms_rate before insert on public.rooms for each row execute function public.community_room_limit();

-- A reply answers a comment on the same post. A reply to a reply answers the
-- comment that one answered, so threads stay one level deep.
create or replace function public.comments_reply_place()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  above public.comments;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into above from public.comments where id = new.parent_id;
  if above.id is null or above.post_id <> new.post_id then
    raise exception 'a reply must answer a comment on the same post';
  end if;
  if above.parent_id is not null then
    new.parent_id := above.parent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists comments_reply on public.comments;
create trigger comments_reply before insert on public.comments for each row execute function public.comments_reply_place();

-- The person a message went to may only mark it read; nothing else in it changes.
create or replace function public.messages_only_read()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.sender <> old.sender or new.recipient <> old.recipient or new.body <> old.body or new.created_at <> old.created_at then
    raise exception 'only read_at can change';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_read on public.messages;
create trigger messages_read before update on public.messages for each row execute function public.messages_only_read();

alter table public.blocks enable row level security;
alter table public.messages enable row level security;
alter table public.comments enable row level security;
alter table public.rooms enable row level security;
alter table public.room_messages enable row level security;

drop policy if exists "own blocks" on public.blocks;
drop policy if exists "own blocks in" on public.blocks;
drop policy if exists "own blocks go" on public.blocks;
create policy "own blocks" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "own blocks in" on public.blocks for insert to authenticated with check (blocker = auth.uid());
create policy "own blocks go" on public.blocks for delete to authenticated using (blocker = auth.uid());

-- Only the two people in a chat see it.
drop policy if exists "own messages" on public.messages;
drop policy if exists "send messages" on public.messages;
drop policy if exists "mark read" on public.messages;
create policy "own messages" on public.messages for select to authenticated using (auth.uid() in (sender, recipient));
create policy "send messages" on public.messages for insert to authenticated with check (
  sender = auth.uid() and not public.community_blocked(recipient, sender)
);
create policy "mark read" on public.messages for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());

drop policy if exists "comments are public" on public.comments;
drop policy if exists "write comments" on public.comments;
drop policy if exists "remove comments" on public.comments;
create policy "comments are public" on public.comments for select using (true);
create policy "write comments" on public.comments for insert to authenticated with check (
  author = auth.uid()
  and not exists (select 1 from public.posts p where p.id = post_id and public.community_blocked(p.author, auth.uid()))
);
-- Your own comments, and any comment under your own post.
create policy "remove comments" on public.comments for delete to authenticated using (
  author = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
);

drop policy if exists "rooms are public" on public.rooms;
drop policy if exists "make rooms" on public.rooms;
drop policy if exists "room messages are public" on public.room_messages;
drop policy if exists "write in rooms" on public.room_messages;
drop policy if exists "remove own room messages" on public.room_messages;
create policy "rooms are public" on public.rooms for select using (true);
create policy "make rooms" on public.rooms for insert to authenticated with check (created_by = auth.uid());
create policy "room messages are public" on public.room_messages for select using (true);
create policy "write in rooms" on public.room_messages for insert to authenticated with check (author = auth.uid());
create policy "remove own room messages" on public.room_messages for delete to authenticated using (author = auth.uid());

-- Live updates for the open chat, thread or room.
do $$
declare
  name text;
begin
  foreach name in array array['messages', 'comments', 'room_messages'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = name) then
      execute format('alter publication supabase_realtime add table public.%I', name);
    end if;
  end loop;
end;
$$;
