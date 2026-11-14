import { useState, useEffect, useCallback } from "react";
import { Gift, Home, Mail, RefreshCw, X } from "lucide-react";
import { useAuth } from "../context/authContext";
import { normalizeEmail } from "../lib/auth";
import { createFamily, getPendingInvitesForEmail, acceptInvite, rejectInvite } from "../lib/families";
import { Invite, UserProfile } from "../types";
import { useFirestore } from "../context/FirebaseContext";

interface FamilySetupScreenProps {
  onFamilyReady: (familyId: string) => void;
  error?: string | null;
}

export function FamilySetupScreen({ onFamilyReady, error: externalError }: FamilySetupScreenProps) {
  const db = useFirestore();
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<"create" | "invite">("create");
  const [familyName, setFamilyName] = useState("");
  const [creating, setCreating] = useState(false);

  // Invite acceptance
  const initialEmail = profile?.email ?? user?.email ?? "";
  const [inviteEmail, setInviteEmail] = useState(initialEmail);
  const [pendingInvites, setPendingInvites] = useState<Invite[] | null>(null);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);

  const [localError, setLocalError] = useState<string | null>(null);
  const displayError = localError || externalError;

  const lookupInvites = useCallback(async (emailToLookup: string) => {
    if (!emailToLookup.trim()) return;
    setLocalError(null);
    setLoadingInvites(true);
    try {
      const invites = await getPendingInvitesForEmail(emailToLookup.trim());
      setPendingInvites(invites);
      if (invites.length > 0) {
        setTab("invite");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to look up invites.");
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  // Auto-check on mount for signed-in user
  useEffect(() => {
    let ignore = false;
    const targetEmail = profile?.email || user?.email;
    if (targetEmail) {
      getPendingInvitesForEmail(targetEmail.trim())
        .then((invites) => {
          if (!ignore) {
            setPendingInvites(invites);
            if (invites.length > 0) {
              setTab("invite");
            }
          }
        })
        .catch(() => {
          /* non-fatal */
        });
    }
    return () => {
      ignore = true;
    };
  }, [profile?.email, user?.email]);

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
      const family = await createFamily(familyName.trim(), user, resolvedProfile, db);
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
    await lookupInvites(inviteEmail);
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

  const handleReject = async (invite: Invite) => {
    if (!user) return;
    setLocalError(null);
    setRejectingId(invite.id);
    try {
      await rejectInvite(invite.id, user);
      setConfirmRejectId(null);
      setPendingInvites((prev) => (prev ? prev.filter((i) => i.id !== invite.id) : null));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to decline invite.");
    } finally {
      setRejectingId(null);
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => { setInviteEmail(e.target.value); setPendingInvites(null); }}
                    required
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loadingInvites}
                    style={{ width: "auto", minHeight: "44px", marginTop: 0, padding: "0 16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <RefreshCw aria-hidden="true" style={{ width: 14, height: 14, animation: loadingInvites ? "spin 1s linear infinite" : undefined }} />
                    {loadingInvites ? "Checking…" : "Find"}
                  </button>
                </div>
              </div>
            </form>

            {pendingInvites !== null && (
              <div className="invite-results">
                {pendingInvites.length === 0 ? (
                  <p className="invite-empty">No pending invites found for that address.</p>
                ) : (
                  <ul className="invite-list">
                    {pendingInvites.map((inv) => {
                      const isConfirming = confirmRejectId === inv.id;
                      return (
                        <li key={inv.id} className="invite-item" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span className="invite-family-label">
                                {inv.familyName ? `${inv.familyName} Family` : "Family invite"}
                              </span>
                              <p className="invite-expires">
                                Expires {new Date(inv.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {isConfirming ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(220, 38, 38, 0.1)", padding: "8px 12px", borderRadius: "6px", gap: "8px" }}>
                              <span style={{ fontSize: "0.85rem", color: "#fca5a5" }}>Decline this invite?</span>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}
                                  disabled={rejectingId === inv.id}
                                  onClick={() => handleReject(inv)}
                                >
                                  {rejectingId === inv.id ? "Declining…" : "Yes, decline"}
                                </button>
                                <button
                                  type="button"
                                  style={{ background: "transparent", color: "#ccc", border: "1px solid #555", borderRadius: "4px", padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}
                                  onClick={() => setConfirmRejectId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                              <button
                                type="button"
                                style={{
                                  background: "transparent",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239, 68, 68, 0.4)",
                                  borderRadius: "6px",
                                  padding: "6px 12px",
                                  fontSize: "0.85rem",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                disabled={acceptingId === inv.id || rejectingId === inv.id}
                                onClick={() => setConfirmRejectId(inv.id)}
                              >
                                <X aria-hidden="true" style={{ width: 13, height: 13 }} />
                                Decline
                              </button>
                              <button
                                type="button"
                                className="auth-submit-btn"
                                style={{ minHeight: 36, fontSize: "0.88rem", marginTop: 0, padding: "0 16px", width: "auto" }}
                                onClick={() => handleAccept(inv)}
                                disabled={acceptingId === inv.id || rejectingId === inv.id}
                              >
                                {acceptingId === inv.id ? "Joining…" : "Accept"}
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
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
