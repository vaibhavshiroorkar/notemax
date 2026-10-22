-- Community: public profiles with unique usernames, posts (snapshots of notes
-- and books that their authors chose to publish), and follows. Everyone may
-- read; only the signed-in owner may write their own rows.

create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 400),
  avatar_url text not null default '' check (avatar_url = '' or avatar_url like 'https://%'),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references public.profiles (id) on delete cascade,
  -- The page it was published from, so publishing again updates the same post.
  source_id text not null,
  kind text not null check (kind in ('note', 'book')),
  title text not null default '' check (char_length(title) <= 200),
  summary text not null default '' check (char_length(summary) <= 500),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  -- The snapshot: for a note one part, for a book its description and chapters.
  -- Parts are { title?, level?, body } with body as the editor's JSON.
  parts jsonb not null default '[]',
  -- Plain text of every part, for search.
  text_content text not null default '' check (char_length(text_content) <= 2000000),
  words integer not null default 0,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(summary, '') || ' ' || array_to_string(tags, ' ')), 'B')
    || setweight(to_tsvector('simple', coalesce(text_content, '')), 'C')
  ) stored,
  unique (author, source_id)
);

create index posts_search on public.posts using gin (search);
create index posts_published on public.posts (published_at desc);
create index posts_author on public.posts (author, published_at desc);

create table public.follows (
  follower uuid not null references public.profiles (id) on delete cascade,
  followee uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);

create index follows_followee on public.follows (followee);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "own profile in" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile changes" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "posts are public" on public.posts for select using (true);
create policy "own posts in" on public.posts for insert to authenticated with check (author = auth.uid());
create policy "own posts change" on public.posts for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy "own posts go" on public.posts for delete to authenticated using (author = auth.uid());

create policy "follows are public" on public.follows for select using (true);
create policy "own follows in" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "own follows go" on public.follows for delete to authenticated using (follower = auth.uid());
