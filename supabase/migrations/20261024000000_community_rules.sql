-- Rules the community needs that the app alone cannot keep, since anyone can
-- write to these tables through the API with their own session. Safe to run
-- again: each part replaces what an earlier run made.

-- Dates come from the server. Otherwise a post dated in the future would stay
-- first in everyone's feed, and a profile could stay first among Writers.
create or replace function public.community_post_dates()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.published_at := now();
  else
    new.published_at := old.published_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists posts_dates on public.posts;
create trigger posts_dates
before insert or update on public.posts
for each row execute function public.community_post_dates();

create or replace function public.community_profile_dates()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_dates on public.profiles;
create trigger profiles_dates
before insert or update on public.profiles
for each row execute function public.community_profile_dates();

-- citext compares without case, so the first check let "BOB" through. Compare
-- the plain text instead. Not valid: rows already there are left alone.
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check check (username::text ~ '^[a-z0-9_]{3,24}$') not valid;

-- The text limit meant nothing while the parts could be any size. About 5 MB
-- holds a long book with room to spare.
alter table public.posts drop constraint if exists posts_parts_check;
alter table public.posts add constraint posts_parts_check check (jsonb_typeof(parts) = 'array' and pg_column_size(parts) <= 5000000) not valid;
