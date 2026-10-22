import { useEffect, useState } from "react";
import { accountNames, myProfile, saveProfile, type Profile } from "./api";

/** A first guess at a username from a name: small letters, digits and _. */
const guess = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

/** Your public name in the community: a unique username, the name shown, and a few words about you. */
export function ProfileForm({ onSaved, intro }: { onSaved(profile: Profile): void; intro?: string }) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [had, setHad] = useState(false);

  useEffect(() => {
    void Promise.all([myProfile(), accountNames()])
      .then(([profile, account]) => {
        setHad(!!profile);
        setUsername(profile?.username ?? guess(account.name));
        setName(profile?.display_name ?? account.name);
        setBio(profile?.bio ?? "");
        setAvatar(profile?.avatar_url || account.avatar);
      })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
  }, []);

  return (
    <form
      className="community-form"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        saveProfile({ username, display_name: name.trim(), bio: bio.trim(), avatar_url: avatar.startsWith("https://") ? avatar : "" })
          .then(onSaved, (failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)))
          .finally(() => setBusy(false));
      }}
    >
      <h2>{had ? "Your profile" : "Pick a username"}</h2>
      <p className="community-meta">{intro ?? "This is how people find and follow you. Everyone can see it."}</p>
      <label>
        Username
        <span className="community-at">
          @
          <input
            value={username}
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]{3,24}"
            aria-label="Username"
            onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
        </span>
        <span className="community-meta">3 to 24 small letters, digits or _. Nobody else can have it.</span>
      </label>
      <label>
        Name
        <input value={name} maxLength={60} aria-label="Name shown" onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        About you
        <textarea value={bio} maxLength={400} rows={3} aria-label="About you" onChange={(event) => setBio(event.target.value)} />
      </label>
      {error && <p className="community-error">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy || username.length < 3}>
        {busy ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
