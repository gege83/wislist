import { useState } from "react";
import { Gift, Home, Mail } from "lucide-react";
import { useAuth } from "../context/authContext";
import { normalizeEmail } from "../lib/auth";
import { createFamily, getPendingInvitesForEmail, acceptInvite } from "../lib/families";
import { Invite, UserProfile } from "../types";

interface FamilySetupScreenProps {
  onFamilyReady: (familyId: string) => void;
  error?: string | null;
}

export function FamilySetupScreen({ onFamilyReady, error: externalError }: FamilySetupScreenProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<"create" | "invite">("create");
  const [familyName, setFamilyName] = useState("");
  const [creating, setCreating] = useState(false);

  // Invite acceptance
  const [inviteEmail, setInviteEmail] = useState(profile?.email ?? "");
  const [pendingInvites, setPendingInvites] = useState<Invite[] | null>(null);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const [localError, setLocalError] = useState<string | null>(null);
  const displayError = localError || externalError;

  /** Build a minimal UserProfile from the Firebase User when Firestore profile hasn't loaded yet. */
  const resolveProfile = (): UserProfile => {
    if (profile) return profile;
    if (!user) throw new Error("Not signed in.");
    return {
      displayName: user.displayName || user.email?.split("@")[0] || "Family Member",
      email: user.email ?? "",
      normalizedEmail: normalizeEmail(user.email ?? ""),
      createdAt: new Date().toISOString(),
      lastSelectedFamilyId: null,
    };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !familyName.trim()) return;
    setLocalError(null);
    setCreating(true);
    try {
      const resolvedProfile = resolveProfile();
      const family = await createFamily(familyName.trim(), user, resolvedProfile);
      try { await refreshProfile(); } catch { /* non-fatal */ }
      onFamilyReady(family.id);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to create family.");
    } finally {
      setCreating(false);
    }
  };

  const handleLookupInvites = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setLocalError(null);
    setLoadingInvites(true);
    try {
      const invites = await getPendingInvitesForEmail(inviteEmail.trim());
      setPendingInvites(invites);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to look up invites.");
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleAccept = async (invite: Invite) => {
    if (!user) return;
    setLocalError(null);
    setAcceptingId(invite.id);
    try {
      const resolvedProfile = resolveProfile();
      const familyId = await acceptInvite(invite.id, user, resolvedProfile);
      try { await refreshProfile(); } catch { /* non-fatal */ }
      onFamilyReady(familyId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to accept invite.");
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-header">
          <div className="auth-logo">
            <Gift aria-hidden="true" />
          </div>
          <h1>Welcome to Wishlist</h1>
          <p className="auth-subtitle">
            Create a new family group or accept an invite to join one.
          </p>
        </div>

        <div className="setup-tabs">
          <button
            type="button"
            className={`setup-tab ${tab === "create" ? "active" : ""}`}
            onClick={() => { setTab("create"); setLocalError(null); }}
          >
            <Home aria-hidden="true" style={{ width: 16, height: 16 }} />
            Create family
          </button>
          <button
            type="button"
            className={`setup-tab ${tab === "invite" ? "active" : ""}`}
            onClick={() => { setTab("invite"); setLocalError(null); }}
          >
            <Mail aria-hidden="true" style={{ width: 16, height: 16 }} />
            I have an invite
          </button>
        </div>

        {displayError && (
          <div className="auth-alert error" role="alert">{displayError}</div>
        )}

        {tab === "create" && (
          <form className="auth-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="family-name">Family name</label>
              <input
                id="family-name"
                type="text"
                placeholder="e.g. The Johnson Family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={creating || !familyName.trim()}
            >
              {creating ? "Creating…" : "Create family"}
            </button>
          </form>
        )}

        {tab === "invite" && (
          <>
            <form className="auth-form" onSubmit={handleLookupInvites}>
              <div className="form-group">
                <label htmlFor="invite-email">Your email address</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setPendingInvites(null); }}
                  required
                />
              </div>
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loadingInvites}
              >
                {loadingInvites ? "Checking…" : "Find invites"}
              </button>
            </form>

            {pendingInvites !== null && (
              <div className="invite-results">
                {pendingInvites.length === 0 ? (
                  <p className="invite-empty">No pending invites found for that address.</p>
                ) : (
                  <ul className="invite-list">
                    {pendingInvites.map((inv) => (
                      <li key={inv.id} className="invite-item">
                        <div>
                          <span className="invite-family-label">Family invite</span>
                          <p className="invite-expires">
                            Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="auth-submit-btn"
                          style={{ minHeight: 36, fontSize: "0.88rem", marginTop: 0 }}
                          onClick={() => handleAccept(inv)}
                          disabled={acceptingId === inv.id}
                        >
                          {acceptingId === inv.id ? "Joining…" : "Accept"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
