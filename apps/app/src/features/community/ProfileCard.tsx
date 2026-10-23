import { useEffect, useState } from "react";
import { accountView } from "@/features/account/session";
import { myProfile, type Profile } from "./api";
import { ProfileForm } from "./ProfileForm";
import "./community.css";

/**
 * Your community name where account things live: the username with a way to
 * change it, or the form to pick one. The same form as on the community page.
 */
export function ProfileCard() {
  const signedIn = accountView.use().state === "in";
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    myProfile().then(
      (found) => live && setProfile(found),
      (failure: unknown) => live && setError(failure instanceof Error ? failure.message : String(failure)),
    );
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!signedIn) return <p className="settings-description">Sign in to pick a username for the community.</p>;
  if (error) return <p className="community-error">{error}</p>;
  if (profile === undefined) return <p className="community-meta">Loading...</p>;
  if (!profile || editing)
    return (
      <ProfileForm
        intro={profile ? undefined : "Pick a username so people can find and follow you. You can change it later."}
        onSaved={(saved) => {
          setProfile(saved);
          setEditing(false);
        }}
      />
    );
  return (
    <div className="profile-card">
      <span className="profile-card-text">
        <strong>@{profile.username}</strong>
        {profile.display_name && <span className="community-meta">{profile.display_name}</span>}
      </span>
      <button className="button" onClick={() => setEditing(true)}>
        Change username or profile
      </button>
    </div>
  );
}
