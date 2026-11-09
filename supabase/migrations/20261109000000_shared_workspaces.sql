-- Shared workspaces. A workspace someone shares is kept here, so the people
-- it is shared with can open it while the owner is offline. It is stored the
-- way Drive sync stores it: one sealed file per page and device. The key that
-- opens the files is kept here too, and handed out only to people allowed in.
--
-- Who may do what:
--   owner   everything, including deleting the share
--   admin   invites and removes people, sets the link; cannot touch admins unless owner
--   editor  reads and writes
--   viewer  reads
-- "Anyone with the link" is off, view (no sign-in needed) or edit (signed in).
--
-- Nobody reads the tables directly. Every call goes through the functions
-- below, which check the caller's role first. The link token is a secret in
-- the link, so knowing a workspace's id alone opens nothing.

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 200),
  -- The workspace's AES key, base64.
  key text not null check (char_length(key) between 16 and 200),
  link_access text not null default 'off' check (link_access in ('off', 'view', 'edit')),
  link_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create index spaces_owner on public.spaces (owner);

create table public.space_members (
  space uuid not null references public.spaces (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320 and email like '%_@_%'),
  role text not null check (role in ('viewer', 'editor', 'admin')),
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (space, email)
);

create index space_members_email on public.space_members (email);

create table public.space_files (
  space uuid not null references public.spaces (id) on delete cascade,
  doc_id text not null check (char_length(doc_id) between 1 and 300),
  device text not null check (char_length(device) between 1 and 100),
  -- Sealed with the workspace key, base64.
  data text not null,
  -- The transaction that wrote it, for reading only what changed since last time.
  written_tx bigint not null,
  written_by uuid references auth.users (id) on delete set null,
  written_at timestamptz not null default now(),
  primary key (space, doc_id, device)
);

create index space_files_changes on public.space_files (space, written_tx);

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_files enable row level security;
-- No policies: the functions are the only way in.
revoke all on table public.spaces, public.space_members, public.space_files from anon, authenticated;

create or replace function public.space_rank(role text)
returns int
language sql
immutable
set search_path = pg_catalog
as $$ select case role when 'viewer' then 1 when 'editor' then 2 when 'admin' then 3 when 'owner' then 4 else 0 end $$;

-- The caller's email, as invitations are kept, or '' when signed out.
create or replace function public.space_email()
returns text
language sql
stable
set search_path = pg_catalog
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- The caller's role in a space: the best of what they were invited as and what
-- the link gives. Null when they may not see it at all.
create or replace function public.space_role(p_space uuid, p_token text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  s public.spaces;
  invited text;
  linked text;
begin
  select * into s from public.spaces where id = p_space;
  if not found then return null; end if;
  if auth.uid() is not null and s.owner = auth.uid() then return 'owner'; end if;
  if public.space_email() <> '' then
    select role into invited from public.space_members where space = p_space and email = public.space_email();
  end if;
  if p_token is not null and p_token = s.link_token then
    if s.link_access = 'edit' and auth.uid() is not null then linked := 'editor';
    elsif s.link_access in ('view', 'edit') then linked := 'viewer';
    end if;
  end if;
  if public.space_rank(invited) >= public.space_rank(linked) then return invited; end if;
  return linked;
end;
$$;

create or replace function public.space_need(p_space uuid, p_token text, p_least text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  r text := public.space_role(p_space, p_token);
begin
  if public.space_rank(r) < public.space_rank(p_least) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return r;
end;
$$;

-- Starts sharing a workspace. Returns its id and link token.
create or replace function public.space_create(p_name text, p_key text)
returns json
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  s public.spaces;
begin
  if auth.uid() is null then raise exception 'sign in to share' using errcode = '42501'; end if;
  if (select count(*) from public.spaces where owner = auth.uid()) >= 50 then
    raise exception 'you can share up to 50 workspaces' using errcode = '54000';
  end if;
  insert into public.spaces (owner, name, key) values (auth.uid(), left(coalesce(p_name, ''), 200), p_key) returning * into s;
  return json_build_object('id', s.id, 'token', s.link_token);
end;
$$;

-- What opening a space needs: its key and the caller's role. Admins also get the link.
create or replace function public.space_open(p_space uuid, p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  s public.spaces;
  r text := public.space_role(p_space, p_token);
  owner_email text;
begin
  if r is null then return null; end if;
  select * into s from public.spaces where id = p_space;
  select email into owner_email from auth.users where id = s.owner;
  return json_build_object(
    'id', s.id,
    'name', s.name,
    'key', s.key,
    'role', r,
    'owner', owner_email,
    'linkAccess', s.link_access,
    'linkToken', case when public.space_rank(r) >= 3 then s.link_token end
  );
end;
$$;

-- Files written since `p_after` (all of them when null), and where to start next time.
-- The cursor is the oldest transaction still running, so a write that commits late is never skipped.
create or replace function public.space_changes(p_space uuid, p_token text, p_after bigint)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  next_cursor bigint := pg_snapshot_xmin(pg_current_snapshot())::text::bigint;
begin
  perform public.space_need(p_space, p_token, 'viewer');
  return json_build_object(
    'cursor', next_cursor,
    'entries', coalesce((
      select json_agg(json_build_object('docId', doc_id, 'device', device))
      from public.space_files
      where space = p_space and (p_after is null or written_tx >= p_after)
    ), '[]'::json)
  );
end;
$$;

create or replace function public.space_read(p_space uuid, p_token text, p_doc text, p_device text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.space_need(p_space, p_token, 'viewer');
  return (select data from public.space_files where space = p_space and doc_id = p_doc and device = p_device);
end;
$$;

create or replace function public.space_write(p_space uuid, p_token text, p_doc text, p_device text, p_data text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.space_need(p_space, p_token, 'editor');
  if auth.uid() is null then raise exception 'sign in to edit' using errcode = '42501'; end if;
  if char_length(p_data) > 9000000 then raise exception 'file too big to share' using errcode = '54000'; end if;
  insert into public.space_files (space, doc_id, device, data, written_tx, written_by, written_at)
  values (p_space, p_doc, p_device, p_data, pg_current_xact_id()::text::bigint, auth.uid(), now())
  on conflict (space, doc_id, device) do update
    set data = excluded.data, written_tx = excluded.written_tx, written_by = excluded.written_by, written_at = excluded.written_at;
end;
$$;

create or replace function public.space_remove(p_space uuid, p_token text, p_doc text, p_device text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.space_need(p_space, p_token, 'editor');
  delete from public.space_files where space = p_space and doc_id = p_doc and device = p_device;
end;
$$;

-- The docs one device has a file for.
create or replace function public.space_mine(p_space uuid, p_token text, p_device text)
returns setof text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.space_need(p_space, p_token, 'viewer');
  return query select doc_id from public.space_files where space = p_space and device = p_device;
end;
$$;

-- Who is invited. Any signed-in member sees the list, like in a shared doc elsewhere.
create or replace function public.space_people(p_space uuid, p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.space_need(p_space, p_token, 'viewer');
  if auth.uid() is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object('email', email, 'role', role, 'addedAt', added_at) order by added_at)
    from public.space_members where space = p_space
  ), '[]'::json);
end;
$$;

-- Invites someone, or changes their role. Admins may add viewers and editors; only the owner adds admins.
create or replace function public.space_invite(p_space uuid, p_token text, p_email text, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  r text := public.space_need(p_space, p_token, 'admin');
  who text := lower(trim(p_email));
  was text;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_role not in ('viewer', 'editor', 'admin') then raise exception 'unknown role' using errcode = '22023'; end if;
  if who = (select lower(email) from auth.users where id = (select owner from public.spaces where id = p_space)) then
    raise exception 'that is the owner' using errcode = '22023';
  end if;
  select role into was from public.space_members where space = p_space and email = who;
  if r <> 'owner' and (p_role = 'admin' or was = 'admin') then
    raise exception 'only the owner changes admins' using errcode = '42501';
  end if;
  if was is null and (select count(*) from public.space_members where space = p_space) >= 100 then
    raise exception 'a workspace can be shared with up to 100 people' using errcode = '54000';
  end if;
  insert into public.space_members (space, email, role, added_by) values (p_space, who, p_role, auth.uid())
  on conflict (space, email) do update set role = excluded.role;
end;
$$;

-- Takes someone off. Anyone may take themselves off; admins others, except admins unless owner.
create or replace function public.space_uninvite(p_space uuid, p_token text, p_email text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  who text := lower(trim(p_email));
  r text;
  was text;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if who <> public.space_email() then
    r := public.space_need(p_space, p_token, 'admin');
    select role into was from public.space_members where space = p_space and email = who;
    if r <> 'owner' and was = 'admin' then raise exception 'only the owner removes admins' using errcode = '42501'; end if;
  end if;
  delete from public.space_members where space = p_space and email = who;
end;
$$;

-- Sets what anyone with the link may do. A new token makes old links stop working.
create or replace function public.space_set_link(p_space uuid, p_token text, p_access text, p_new_token boolean)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  t text;
begin
  perform public.space_need(p_space, p_token, 'admin');
  if p_access not in ('off', 'view', 'edit') then raise exception 'unknown access' using errcode = '22023'; end if;
  update public.spaces
    set link_access = p_access,
        link_token = case when p_new_token then replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') else link_token end
    where id = p_space
    returning link_token into t;
  return t;
end;
$$;

create or replace function public.space_rename(p_space uuid, p_token text, p_name text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.space_need(p_space, p_token, 'admin');
  update public.spaces set name = left(coalesce(p_name, ''), 200) where id = p_space;
end;
$$;

-- Stops sharing: the copy here and every invitation go. People keep what their devices have.
create or replace function public.space_delete(p_space uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
begin
  if public.space_role(p_space, null) is distinct from 'owner' then raise exception 'only the owner stops sharing' using errcode = '42501'; end if;
  delete from public.spaces where id = p_space;
end;
$$;

-- Workspaces shared with the caller by invitation, for Home.
create or replace function public.spaces_for_me()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or public.space_email() = '' then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object('id', s.id, 'name', s.name, 'role', m.role, 'owner', u.email, 'addedAt', m.added_at) order by m.added_at desc)
    from public.space_members m
    join public.spaces s on s.id = m.space
    left join auth.users u on u.id = s.owner
    where m.email = public.space_email()
  ), '[]'::json);
end;
$$;

revoke execute on function
  public.space_role(uuid, text), public.space_need(uuid, text, text), public.space_create(text, text),
  public.space_open(uuid, text), public.space_changes(uuid, text, bigint), public.space_read(uuid, text, text, text),
  public.space_write(uuid, text, text, text, text), public.space_remove(uuid, text, text, text),
  public.space_mine(uuid, text, text), public.space_people(uuid, text), public.space_invite(uuid, text, text, text),
  public.space_uninvite(uuid, text, text), public.space_set_link(uuid, text, text, boolean),
  public.space_rename(uuid, text, text), public.space_delete(uuid), public.spaces_for_me()
-- Supabase grants new functions to anon and authenticated by default, so those go too.
from public, anon, authenticated;

-- Reading works signed out, for "anyone with the link can view".
grant execute on function
  public.space_open(uuid, text), public.space_changes(uuid, text, bigint),
  public.space_read(uuid, text, text, text), public.space_mine(uuid, text, text), public.space_people(uuid, text)
to anon, authenticated;

grant execute on function
  public.space_create(text, text), public.space_write(uuid, text, text, text, text), public.space_remove(uuid, text, text, text),
  public.space_invite(uuid, text, text, text), public.space_uninvite(uuid, text, text), public.space_set_link(uuid, text, text, boolean),
  public.space_rename(uuid, text, text), public.space_delete(uuid), public.spaces_for_me()
to authenticated;
