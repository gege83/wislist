import { useState } from "react";
import { Mail, RefreshCw, Check, X, Clock, ArrowLeft, Users } from "lucide-react";
import { useAuth } from "../context/authContext";
import { Invite } from "../types";

interface InvitationsScreenProps {
  invites: Invite[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onAccept: (invite: Invite) => Promise<void>;
  onReject: (invite: Invite) => Promise<void>;
  onBack?: () => void;
}

export function InvitationsScreen({
  invites,
  loading,
  onRefresh,
  onAccept,
  onReject,
  onBack,
}: InvitationsScreenProps) {
  const { user, profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const userEmail = profile?.email || user?.email || "";

  const handleRefresh = async () => {
    setActionError(null);
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to refresh invitations.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccept = async (invite: Invite) => {
    setActionError(null);
    setActionSuccess(null);
    setAcceptingId(invite.id);
    try {
      await onAccept(invite);
      setActionSuccess(`Successfully joined ${invite.familyName || "the family"}!`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to accept invite.");
    } finally {
      setAcceptingId(null);
    }
  };

  const handleConfirmReject = async (invite: Invite) => {
    setActionError(null);
    setActionSuccess(null);
    setRejectingId(invite.id);
    try {
      await onReject(invite);
      setConfirmRejectId(null);
      setActionSuccess("Invitation declined.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to decline invite.");
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="claims-screen">
      <header className="claims-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {onBack && (
            <button
              type="button"
              className="back-btn"
              onClick={onBack}
              aria-label="Back to Family"
            >
              <ArrowLeft aria-hidden="true" style={{ width: 18, height: 18 }} />
            </button>
          )}
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Mail aria-hidden="true" style={{ width: 24, height: 24, color: "#e88080" }} />
              Invitations
            </h1>
            <p className="claims-subtitle">
              Family invitations sent to <strong>{userEmail}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          className="claims-back-link"
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
          onClick={handleRefresh}
          disabled={loading || refreshing}
        >
          <RefreshCw
            aria-hidden="true"
            style={{
              width: 15,
              height: 15,
              animation: refreshing ? "spin 1s linear infinite" : undefined,
            }}
          />
          {refreshing ? "Checking…" : "Refresh"}
        </button>
      </header>

      {actionError && (
        <div className="auth-alert error" role="alert" style={{ marginBottom: "16px" }}>
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="auth-alert success" role="status" style={{ marginBottom: "16px" }}>
          {actionSuccess}
        </div>
      )}

      {loading ? (
        <div className="claims-empty-state">
          <p>Looking for invitations…</p>
        </div>
      ) : invites.length === 0 ? (
        <div className="claims-empty-state">
          <Mail style={{ width: 44, height: 44, margin: "0 auto 12px", opacity: 0.5 }} />
          <h3>No pending invitations</h3>
          <p>You have no active family invitations for <strong>{userEmail}</strong>.</p>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: "16px" }}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Checking…" : "Check again"}
          </button>
        </div>
      ) : (
        <ul className="invite-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {invites.map((inv) => {
            const isAccepting = acceptingId === inv.id;
            const isRejecting = rejectingId === inv.id;
            const isConfirmingReject = confirmRejectId === inv.id;
            const expiryDate = new Date(inv.expiresAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <li
                key={inv.id}
                className="invite-item"
                style={{
                  background: "var(--card-bg, #1a2a22)",
                  border: "1px solid var(--border-color, #2d4538)",
                  borderRadius: "10px",
                  padding: "16px 20px",
                  marginBottom: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Users aria-hidden="true" style={{ width: 18, height: 18, color: "#74d49a" }} />
                      <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>
                        {inv.familyName ? `${inv.familyName} Family` : "Family Invitation"}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#8fa397" }}>
                      Sent to: {inv.email}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#e8b87d" }}>
                    <Clock aria-hidden="true" style={{ width: 14, height: 14 }} />
                    <span>Expires {expiryDate}</span>
                  </div>
                </div>

                {isConfirmingReject ? (
                  <div
                    style={{
                      background: "rgba(220, 38, 38, 0.12)",
                      border: "1px solid rgba(220, 38, 38, 0.3)",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: "0.9rem", color: "#fca5a5" }}>
                      Are you sure you want to decline this invitation?
                    </span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        style={{
                          background: "#dc2626",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          padding: "6px 12px",
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                        disabled={isRejecting}
                        onClick={() => handleConfirmReject(inv)}
                      >
                        {isRejecting ? "Declining…" : "Yes, decline"}
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          color: "#cbd5e1",
                          border: "1px solid #475569",
                          borderRadius: "4px",
                          padding: "6px 12px",
                          fontSize: "0.85rem",
                          cursor: "pointer",
                        }}
                        disabled={isRejecting}
                        onClick={() => setConfirmRejectId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                    <button
                      type="button"
                      style={{
                        background: "transparent",
                        color: "#ef4444",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: "6px",
                        padding: "8px 14px",
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        fontWeight: 500,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      disabled={isAccepting || isRejecting}
                      onClick={() => setConfirmRejectId(inv.id)}
                    >
                      <X aria-hidden="true" style={{ width: 14, height: 14 }} />
                      Decline
                    </button>

                    <button
                      type="button"
                      className="btn-primary"
                      style={{
                        padding: "8px 18px",
                        fontSize: "0.9rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      disabled={isAccepting || isRejecting}
                      onClick={() => handleAccept(inv)}
                    >
                      <Check aria-hidden="true" style={{ width: 16, height: 16 }} />
                      {isAccepting ? "Joining…" : "Accept & join"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
