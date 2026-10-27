import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/ui/Icon";
import type { Profile } from "./api";
import { Avatar, messageOf, nameOf, Status, useLoad, whenSent, type Place } from "./bits";
import {
  addComment,
  commentsOn,
  conversations,
  createRoom,
  isBlocked,
  listRooms,
  markRead,
  MAX_BODY,
  NOT_SET_UP,
  onNewRows,
  removeComment,
  removeRoomMessage,
  roomBySlug,
  roomMessages,
  sendMessage,
  sendToRoom,
  setBlocked,
  slugOf,
  thread,
  unreadCount,
  type Comment,
} from "./chat";

// The community's talk: direct messages, rooms, and comments under posts.
// New rows come in live through Realtime; every view also looks again now
// and then, so a dropped connection only slows things down.

const LOOK_AGAIN = 30_000;

/** Reloads on new rows in `table` that match `filter`, and every half minute. */
function useLive(table: "messages" | "comments" | "room_messages", filter: string | null, reload: () => void) {
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    if (!filter) return;
    const stop = onNewRows(table, filter, () => latest.current());
    const timer = setInterval(() => latest.current(), LOOK_AGAIN);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [table, filter]);
}

/** How many messages wait unread, kept current while the community is open. */
export function useUnread(me: string | null): { count: number; refresh(): void } {
  const { data, reload } = useLoad(() => (me ? unreadCount().catch(() => 0) : Promise.resolve(0)), [me]);
  useLive("messages", me ? `recipient=eq.${me}` : null, reload);
  return { count: data ?? 0, refresh: reload };
}

/** A box to write in. Enter sends; Shift+Enter starts a new line. */
function Composer({ label, placeholder, onSend, autoFocus = false }: { label: string; placeholder: string; onSend(text: string): Promise<unknown>; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setProblem(undefined);
    try {
      await onSend(text);
      setText("");
    } catch (failure) {
      setProblem(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="community-composer" onSubmit={(event) => void send(event)}>
      <textarea
        aria-label={label}
        placeholder={placeholder}
        rows={2}
        maxLength={MAX_BODY}
        autoFocus={autoFocus}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) void send(event);
        }}
      />
      <button className="button button-primary" type="submit" disabled={busy || !text.trim()}>
        Send
      </button>
      {problem && <p className="community-error">{problem}</p>}
    </form>
  );
}

/** Why someone cannot write yet, with the way forward. */
function JoinFirst({ me, go, doing }: { me: string | null; go(place: Place): void; doing: string }) {
  return <p className="community-empty">{me ? <button className="link-button" onClick={() => go({ view: "me" })}>Pick a username</button> : "Sign in"} to {doing}.</p>;
}

/** Everyone you have written with, the latest talk first. */
export function MessagesView({ me, go }: { me: string | null; go(place: Place): void }) {
  const { data, error, loading, reload } = useLoad(() => (me ? conversations() : Promise.resolve([])), [me]);
  useLive("messages", me ? `recipient=eq.${me}` : null, reload);
  if (!me) return <p className="community-empty">Sign in to send and read messages.</p>;
  return (
    <section className="community-talk">
      <h2 className="community-heading">Messages</h2>
      <Status error={error} loading={loading && !data}>
        {data?.length ? (
          <ul className="community-conversations">
            {data.map(({ other, last, unread }) => (
              <li key={other.id}>
                <button className="community-conversation" data-unread={unread > 0 || undefined} onClick={() => go({ view: "chat", other })}>
                  <Avatar profile={other} size={36} />
                  <span className="community-conversation-text">
                    <strong>{nameOf(other)}</strong>
                    <span className="community-meta">
                      {last.sender === me ? "You: " : ""}
                      {last.body.slice(0, 80)}
                    </span>
                  </span>
                  <span className="community-meta">{whenSent(last.created_at)}</span>
                  {unread > 0 && (
                    <span className="community-unread" aria-label={`${unread} unread`}>
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="community-empty">No messages yet. Open someone's profile and press Message to start.</p>
        )}
      </Status>
    </section>
  );
}

/** The talk with one person. Opening it marks what they sent as read. */
export function ChatView({ other, me, hasProfile, go, onRead }: { other: Profile; me: string | null; hasProfile: boolean; go(place: Place): void; onRead(): void }) {
  const { data, error, loading, reload } = useLoad(() => thread(other.id), [other.id]);
  const blocked = useLoad(() => isBlocked(other.id), [other.id]);
  const [problem, setProblem] = useState<string>();
  useLive("messages", `sender=eq.${other.id}`, reload);
  const end = useRef<HTMLDivElement>(null);
  const unread = data?.some((message) => message.sender === other.id && !message.read_at);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    if (unread) void markRead(other.id).then(onRead, () => {});
  }, [data, unread, other.id, onRead]);
  const block = async (on: boolean) => {
    setProblem(undefined);
    try {
      await setBlocked(other.id, on);
      blocked.reload();
    } catch (failure) {
      setProblem(messageOf(failure));
    }
  };
  if (!me) return <p className="community-empty">Sign in to send and read messages.</p>;
  return (
    <section className="community-talk community-chat">
      <header className="community-chat-top">
        <button className="community-person" onClick={() => go({ view: "profile", username: other.username })}>
          <Avatar profile={other} size={32} />
          <span>{nameOf(other)}</span>
          <span className="community-handle">@{other.username}</span>
        </button>
        <span className="community-top-space" />
        <button className="link-button" onClick={() => void block(!blocked.data)} title={blocked.data ? "Let them write to you again" : "Stop their messages, and their comments under your posts"}>
          {blocked.data ? "Unblock" : "Block"}
        </button>
      </header>
      {problem && <p className="community-error">{problem}</p>}
      <Status error={error} loading={loading && !data}>
        <ol className="community-thread" aria-label={`Messages with ${nameOf(other)}`}>
          {(data ?? []).map((message) => (
            <li key={message.id} className="community-bubble" data-mine={message.sender === me || undefined}>
              <span className="community-bubble-text">{message.body}</span>
              <span className="community-meta">{whenSent(message.created_at)}</span>
            </li>
          ))}
          {!data?.length && <li className="community-empty">Say hello.</li>}
        </ol>
        <div ref={end} />
      </Status>
      {blocked.data ? (
        <p className="community-empty">You blocked {nameOf(other)}. Unblock them to write.</p>
      ) : hasProfile ? (
        <Composer label={`Message ${nameOf(other)}`} placeholder="Write a message" autoFocus onSend={(text) => sendMessage(other.id, text).then(reload)} />
      ) : (
        <JoinFirst me={me} go={go} doing="send messages" />
      )}
    </section>
  );
}

/** Topic rooms anyone can read, and anyone with a profile can talk in or start. */
export function RoomsView({ me, hasProfile, go }: { me: string | null; hasProfile: boolean; go(place: Place): void }) {
  const { data, error, loading } = useLoad(() => listRooms(), []);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const start = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(undefined);
    try {
      const room = await createRoom(name, about);
      go({ view: "room", slug: room.slug });
    } catch (failure) {
      setProblem(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="community-talk">
      <h2 className="community-heading">Rooms</h2>
      <Status error={error} loading={loading && !data}>
        {data?.length ? (
          <ul className="community-rooms">
            {data.map((room) => (
              <li key={room.id}>
                <button className="community-room" onClick={() => go({ view: "room", slug: room.slug })}>
                  <strong>#{room.slug}</strong>
                  <span>{room.name}</span>
                  {room.description && <span className="community-meta">{room.description}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="community-empty">No rooms yet.</p>
        )}
      </Status>
      {hasProfile ? (
        <form className="community-box community-new-room" onSubmit={(event) => void start(event)}>
          <h3>Start a room</h3>
          <input aria-label="Room name" placeholder="Name, like Fantasy writers" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
          {name.trim() && <span className="community-meta">#{slugOf(name) || "..."}</span>}
          <input aria-label="What the room is for" placeholder="What it is for (optional)" maxLength={300} value={about} onChange={(event) => setAbout(event.target.value)} />
          <button className="button button-primary" type="submit" disabled={busy || slugOf(name).length < 2}>
            Start room
          </button>
          {problem && <p className="community-error">{problem}</p>}
        </form>
      ) : (
        <JoinFirst me={me} go={go} doing="start a room" />
      )}
    </section>
  );
}

/** One room: its last hundred messages, live, and a box to write in. */
export function RoomView({ slug, me, hasProfile, go }: { slug: string; me: string | null; hasProfile: boolean; go(place: Place): void }) {
  const room = useLoad(() => roomBySlug(slug), [slug]);
  const id = room.data?.id ?? null;
  const { data, error, loading, reload } = useLoad(() => (id ? roomMessages(id) : Promise.resolve([])), [id]);
  useLive("room_messages", id ? `room_id=eq.${id}` : null, reload);
  const end = useRef<HTMLDivElement>(null);
  // Braces: scroll calls may return a promise, and an effect must return nothing or a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [data]);
  if (room.error || (room.loading && !room.data)) return <Status error={room.error} loading>{null}</Status>;
  if (!room.data) return <p className="community-empty">There is no room #{slug}.</p>;
  return (
    <section className="community-talk community-chat">
      <header className="community-chat-top">
        <span className="community-room-name">
          <strong>#{room.data.slug}</strong> {room.data.name}
        </span>
      </header>
      {room.data.description && <p className="community-meta">{room.data.description}</p>}
      <Status error={error} loading={loading && !data}>
        <ol className="community-thread" aria-label={`Messages in #${room.data.slug}`}>
          {(data ?? []).map((message) => (
            <li key={message.id} className="community-line">
              <button className="community-person" onClick={() => message.profile && go({ view: "profile", username: message.profile.username })}>
                <Avatar profile={message.profile} size={22} />
                <strong>{nameOf(message.profile)}</strong>
              </button>
              <span className="community-meta">{whenSent(message.created_at)}</span>
              {message.author === me && (
                <button className="link-button community-remove" onClick={() => void removeRoomMessage(message.id).then(reload)}>
                  Delete
                </button>
              )}
              <p className="community-line-text">{message.body}</p>
            </li>
          ))}
          {!data?.length && <li className="community-empty">Nobody has said anything yet.</li>}
        </ol>
        <div ref={end} />
      </Status>
      {hasProfile ? <Composer label={`Message #${room.data.slug}`} placeholder={`Write in #${room.data.slug}`} onSend={(text) => sendToRoom(room.data!.id, text).then(reload)} /> : <JoinFirst me={me} go={go} doing="talk here" />}
    </section>
  );
}

/** One comment, with Reply, and Delete for its writer and the post's author. */
function CommentItem({ comment, me, postAuthor, go, onReply, onRemoved }: { comment: Comment; me: string | null; postAuthor: string; go(place: Place): void; onReply?(): void; onRemoved(): void }) {
  const [problem, setProblem] = useState<string>();
  const remove = () =>
    removeComment(comment.id).then(onRemoved, (failure: unknown) => setProblem(messageOf(failure)));
  return (
    <div className="community-comment">
      <button className="community-person" onClick={() => comment.profile && go({ view: "profile", username: comment.profile.username })}>
        <Avatar profile={comment.profile} size={22} />
        <strong>{nameOf(comment.profile)}</strong>
      </button>
      <span className="community-meta">{whenSent(comment.created_at)}</span>
      <p className="community-line-text">{comment.body}</p>
      <span className="community-comment-actions">
        {onReply && (
          <button className="link-button" onClick={onReply}>
            Reply
          </button>
        )}
        {me && (comment.author === me || postAuthor === me) && (
          <button className="link-button community-remove" onClick={() => void remove()}>
            Delete
          </button>
        )}
      </span>
      {problem && <p className="community-error">{problem}</p>}
    </div>
  );
}

/** Comments under a post, with replies one level in. */
export function Comments({ postId, postAuthor, me, hasProfile, go }: { postId: string; postAuthor: string; me: string | null; hasProfile: boolean; go(place: Place): void }) {
  const { data, error, loading, reload } = useLoad(() => commentsOn(postId), [postId]);
  useLive("comments", `post_id=eq.${postId}`, reload);
  const [replying, setReplying] = useState<string | null>(null);
  const all = data ?? [];
  const top = all.filter((comment) => !comment.parent_id);
  const repliesTo = (id: string) => all.filter((comment) => comment.parent_id === id);
  // Readers see no error under every post while the server has no comments yet.
  if (error === NOT_SET_UP) return null;
  return (
    <section className="community-comments" aria-label="Comments">
      <h2 className="community-heading">
        <Icon name="people" />
        {all.length ? `${all.length} comment${all.length === 1 ? "" : "s"}` : "Comments"}
      </h2>
      {hasProfile ? <Composer label="Comment" placeholder="Add a comment" onSend={(text) => addComment(postId, text).then(reload)} /> : <JoinFirst me={me} go={go} doing="comment" />}
      <Status error={error} loading={loading && !data}>
        <ul className="community-comment-list">
          {top.map((comment) => (
            <li key={comment.id}>
              <CommentItem comment={comment} me={me} postAuthor={postAuthor} go={go} onReply={hasProfile ? () => setReplying(replying === comment.id ? null : comment.id) : undefined} onRemoved={reload} />
              {(repliesTo(comment.id).length > 0 || replying === comment.id) && (
                <ul className="community-replies">
                  {repliesTo(comment.id).map((reply) => (
                    <li key={reply.id}>
                      <CommentItem comment={reply} me={me} postAuthor={postAuthor} go={go} onRemoved={reload} />
                    </li>
                  ))}
                  {replying === comment.id && (
                    <li>
                      <Composer
                        label={`Reply to ${nameOf(comment.profile)}`}
                        placeholder="Write a reply"
                        autoFocus
                        onSend={(text) =>
                          addComment(postId, text, comment.id).then(() => {
                            setReplying(null);
                            reload();
                          })
                        }
                      />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Status>
    </section>
  );
}
