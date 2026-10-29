-- Private notes from readers to an author: a reader picks some lines of a
-- post (or none) and writes a note only the author and the reader can see.
-- The author reads them beside the page the post came from and can jump to
-- the lines. Also a few limits the community was missing.
--
-- Safe to run again: everything is created only when missing, and triggers,
-- policies and constraints are replaced. Needs 20261025000000_community_chat.sql
-- first, for community_blocked, community_written_now and the rate limit.

create table if not exists public.reader_notes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  -- The reader who wrote it.
  author uuid not null references public.profiles (id) on delete cascade,
  -- Which part of the post the lines are in: 0 for a note, a chapter's place for a book.
  part integer not null default 0 check (part between 0 and 9999),
  -- The page the part came from, when the post says, so the author lands on it.
  part_id text not null default '' check (char_length(part_id) <= 100),
  quote text not null default '' check (char_length(quote) <= 1000),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists reader_notes_post on public.reader_notes (post_id, created_at desc);
create index if not exists reader_notes_author on public.reader_notes (author, created_at desc);

drop trigger if exists reader_notes_now on public.reader_notes;
create trigger reader_notes_now before insert on public.reader_notes for each row execute function public.community_written_now();

-- One limit for everything people write to each other: at most 20 messages,
-- comments, room messages and reader notes together per minute per person.
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
       + (select count(*) from public.reader_notes where author = writer and created_at > now() - interval '1 minute')
    into recent;
  if recent >= 20 then
    raise exception 'too many messages, wait a minute' using errcode = 'P0001', hint = 'rate_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists reader_notes_rate on public.reader_notes;
create trigger reader_notes_rate before insert on public.reader_notes for each row execute function public.community_rate_limit();

-- The author may only mark a note read; what the reader wrote stays as written.
create or replace function public.reader_notes_only_read()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.post_id <> old.post_id or new.author <> old.author or new.part <> old.part or new.part_id <> old.part_id
     or new.quote <> old.quote or new.body <> old.body or new.created_at <> old.created_at then
    raise exception 'only read_at can change';
  end if;
  return new;
end;
$$;

drop trigger if exists reader_notes_read on public.reader_notes;
create trigger reader_notes_read before update on public.reader_notes for each row execute function public.reader_notes_only_read();

alter table public.reader_notes enable row level security;

drop policy if exists "reader notes for the two" on public.reader_notes;
drop policy if exists "write reader notes" on public.reader_notes;
drop policy if exists "author marks reader notes read" on public.reader_notes;
drop policy if exists "remove reader notes" on public.reader_notes;
-- Only the reader who wrote it and the post's author see a note.
create policy "reader notes for the two" on public.reader_notes for select to authenticated using (
  author = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
);
-- Not on your own post, and not to someone who blocked you.
create policy "write reader notes" on public.reader_notes for insert to authenticated with check (
  author = auth.uid()
  and exists (select 1 from public.posts p where p.id = post_id and p.author <> auth.uid() and not public.community_blocked(p.author, auth.uid()))
);
create policy "author marks reader notes read" on public.reader_notes for update to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid()));
create policy "remove reader notes" on public.reader_notes for delete to authenticated using (
  author = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
);

-- Limits the first tables lacked. Not valid: rows already there are left alone.
alter table public.posts drop constraint if exists posts_source_id_check;
alter table public.posts add constraint posts_source_id_check check (char_length(source_id) between 1 and 100) not valid;
alter table public.posts drop constraint if exists posts_words_check;
alter table public.posts add constraint posts_words_check check (words between 0 and 10000000) not valid;
alter table public.profiles drop constraint if exists profiles_avatar_url_length;
alter table public.profiles add constraint profiles_avatar_url_length check (char_length(avatar_url) <= 500) not valid;

-- At most 30 new posts a day per person, so one account cannot fill the feed.
-- Publishing a page again updates its post and does not count.
create or replace function public.community_post_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- The app publishes with an upsert, which runs this even when it ends up updating.
  if exists (select 1 from public.posts where author = new.author and source_id = new.source_id) then
    return new;
  end if;
  if (select count(*) from public.posts where author = auth.uid() and published_at > now() - interval '1 day') >= 30 then
    raise exception 'too many new posts, try again tomorrow' using errcode = 'P0001', hint = 'post_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_limit on public.posts;
create trigger posts_limit before insert on public.posts for each row execute function public.community_post_limit();
