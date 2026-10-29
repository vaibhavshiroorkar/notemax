-- Indexes for the queries the community makes on every write. The rate
-- limit counts each writer's messages and comments of the last minute; without
-- these, every new message or comment read the whole table, more slowly as it grew.
--
-- Safe to run again: each index is created only when missing. Needs
-- 20261025000000_community_chat.sql first.

-- community_rate_limit: "where sender = writer and created_at > ...", and the app's
-- list of conversations, which reads messages by sender or by recipient.
create index if not exists messages_sender on public.messages (sender, created_at desc);

-- community_rate_limit, for comments and for room messages.
create index if not exists comments_author on public.comments (author, created_at desc);
create index if not exists room_messages_author on public.room_messages (author, created_at desc);

-- Deleting a comment deletes its replies; this finds them without reading every comment.
create index if not exists comments_parent on public.comments (parent_id) where parent_id is not null;
