import { useState, useEffect, useCallback } from "react";
import {
  Gift,
  ListChecks,
  LockKeyhole,
  LogOut,
  Mail,
  MailPlus,
  ShieldCheck,
  Users,
  X,
  Plus,
  Settings,
  Edit3,
  Trash2,
  WifiOff,
} from "lucide-react";
import { firebaseApp } from "./lib/firebase";
import { useAuth } from "./context/authContext";
import { normalizeEmail } from "./lib/auth";
import { AuthScreen } from "./components/AuthScreen";
import { MyClaimsScreen } from "./components/MyClaimsScreen";
import { InvitationsScreen } from "./components/InvitationsScreen";
import { FamilySetupScreen } from "./components/FamilySetupScreen";
import { WishModal } from "./components/WishModal";
import { GiftIdeaModal } from "./components/GiftIdeaModal";
import { FamilySettingsModal } from "./components/FamilySettingsModal";
import {
  createInvite,
  acceptInvite,
  rejectInvite,
  getPendingInvitesForEmail,
  getSentInvitesForUser,
  createManagedChildProfile,
} from "./lib/families";
import { deleteWish, subscribeWishesForRecipient } from "./lib/wishes";
import { deleteGiftIdea } from "./lib/giftIdeas";
import { claimItem, unclaimItem } from "./lib/claims";
import { Wish, Invite } from "./types";
import {
  acceptInviteAndRefresh,
  refreshInviteLists,
} from "./lib/inviteRefresh";
import { useFamilyWorkspace } from "./lib/familyWorkspace";

// ─── Modal helper ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X aria-hidden="true" style={{ width: 18, height: 18 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [currentView, setCurrentView] = useState<
    "family" | "wishes" | "claims" | "invites"
  >("family");
  const projectId = firebaseApp.options.projectId ?? "local emulator";

  // ── Family data ──────────────────────────────────────────────────────────
  const workspace = useFamilyWorkspace(user, profile);
  const {
    families: allUserFamilies,
    family,
    members,
    selectedMember,
    wishes: memberWishes,
    giftIdeas: memberGiftIdeas,
    claims,
    loading: familyLoading,
    error: familyError,
    dataLoading,
    dataError,
    selectFamily,
    selectMember,
    refresh: loadFamily,
    refreshMembers,
    addMember,
    updateClaims,
  } = workspace;

  // ── Pending invites ───────────────────────────────────────────────────────
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // ── Selected member for wish / gift-idea panel ───────────────────────────
  // ── My own wishes (for "My wishes" nav tab) ──────────────────────────────
  const [myWishes, setMyWishes] = useState<Wish[]>([]);

  // ── Modals ───────────────────────────────────────────────────────────────
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [showChildModal, setShowChildModal] = useState(false);
  const [childName, setChildName] = useState("");
  const [addingChild, setAddingChild] = useState(false);
  const [childError, setChildError] = useState<string | null>(null);

  const [showWishModal, setShowWishModal] = useState(false);
  const [wishModalTarget, setWishModalTarget] = useState<{
    recipientId: string;
    recipientName: string;
  } | null>(null);
  const [editingWish, setEditingWish] = useState<Wish | null>(null);

  const [showGiftIdeaModal, setShowGiftIdeaModal] = useState(false);
  const [showFamilySettings, setShowFamilySettings] = useState(false);

  // ── Network status ───────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Wish claim / unclaim feedback ────────────────────────────────────────
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimConflict, setClaimConflict] = useState<{
    targetId: string;
    message: string;
  } | null>(null);

  // ── Load family on mount / when profile changes ──────────────────────────
  const familyId = family?.id;
  const userId = user?.uid;
  const wishPanelLoading = Boolean(selectedMember && dataLoading);

  // ── Real-time my own wishes subscription ─────────────────────────────────
  useEffect(() => {
    if (!userId || !familyId || currentView !== "wishes") return;

    const unsub = subscribeWishesForRecipient(
      userId,
      familyId,
      (wishes) => {
        setMyWishes(wishes);
      },
      (err) => {
        console.error("My wishes subscription error:", err);
      },
    );

    return () => {
      unsub();
    };
  }, [userId, familyId, currentView]);

  // ── Load pending invites ─────────────────────────────────────────────────
  const loadPendingInvites = useCallback(async () => {
    const email = profile?.email || user?.email;
    if (!email) return;
    setLoadingInvites(true);
    try {
      const invs = await getPendingInvitesForEmail(email);
      setPendingInvites(invs);
    } catch (err) {
      console.error("Failed to load pending invites:", err);
    } finally {
      setLoadingInvites(false);
    }
  }, [profile?.email, user?.email]);

  const loadSentInvites = useCallback(async () => {
    if (!user) return;
    setLoadingInvites(true);
    try {
      const invs = await getSentInvitesForUser(user.uid);
      setSentInvites(invs);
    } catch (err) {
      console.error("Failed to load sent invites:", err);
    } finally {
      setLoadingInvites(false);
    }
  }, [user]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadPendingInvites();
      void loadSentInvites();
    });
  }, [loadPendingInvites, loadSentInvites]);

  // ── Derived metrics ──────────────────────────────────────────────────────
  const totalWishes = memberWishes.length + memberGiftIdeas.length;
  const unclaimed = [...memberWishes, ...memberGiftIdeas].filter((item) => {
    const claimKey = memberWishes.includes(item as Wish)
      ? `wish_${item.id}`
      : `giftIdea_${item.id}`;
    return !claims[claimKey];
  }).length;

  const currentUserMember = members.find((m) => m.userId === user?.uid);
  const isAdmin = currentUserMember?.admin === true;
  const otherMembers = members.filter((m) => m.userId !== user?.uid);

  const isGuardianOfSelected =
    selectedMember?.kind === "managedChild" &&
    (selectedMember.guardianIds?.includes(user?.uid ?? "") || isAdmin);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !family || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      await createInvite(family.id, inviteEmail.trim(), user, family.name);
      setInviteSuccess(true);
      setInviteEmail("");
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to send invite.",
      );
    } finally {
      setInviting(false);
    }
  };

  const handleAcceptInvite = async (inv: Invite) => {
    if (!user) return;
    const resolvedProfile = profile || {
      displayName:
        user.displayName || user.email?.split("@")[0] || "Family Member",
      email: user.email ?? "",
      normalizedEmail: normalizeEmail(user.email ?? ""),
      createdAt: new Date().toISOString(),
      lastSelectedFamilyId: null,
    };
    const joinedFamilyId = await acceptInviteAndRefresh(
      () => acceptInvite(inv.id, user, resolvedProfile),
      () => refreshInviteLists(loadPendingInvites, loadSentInvites),
    );
    try {
      await refreshProfile();
    } catch {
      /* non-fatal */
    }
    await loadFamily(joinedFamilyId);
    setCurrentView("family");
  };

  const handleRejectInvite = async (inv: Invite) => {
    if (!user) return;
    await rejectInvite(inv.id, user);
    await loadPendingInvites();
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !family || !childName.trim()) return;
    setAddingChild(true);
    setChildError(null);
    try {
      const child = await createManagedChildProfile(
        family.id,
        childName.trim(),
        user,
      );
      addMember(child);
      setChildName("");
      setShowChildModal(false);
      selectMember(child);
    } catch (err) {
      setChildError(
        err instanceof Error ? err.message : "Failed to add child profile.",
      );
    } finally {
      setAddingChild(false);
    }
  };

  const handleClaim = async (
    targetType: "wish" | "giftIdea",
    targetId: string,
    recipientId: string,
  ) => {
    if (!user || !family) return;
    const compositeId = `${targetType}_${targetId}`;
    setClaimingId(compositeId);
    setClaimConflict(null);
    try {
      if (claims[compositeId]) {
        await unclaimItem(compositeId, user);
        updateClaims((prev) => {
          const next = { ...prev };
          delete next[compositeId];
          return next;
        });
      } else {
        const claim = await claimItem(
          targetType,
          targetId,
          recipientId,
          user,
          family.id,
        );
        updateClaims((prev) => ({ ...prev, [compositeId]: claim }));
      }
    } catch (err: unknown) {
      console.error("Claim error:", err);
      const msg = err instanceof Error ? err.message : "";
      const isAlreadyClaimed = msg
        .toLowerCase()
        .includes("already been claimed");
      setClaimConflict({
        targetId,
        message: isAlreadyClaimed
          ? "Someone else just claimed this item!"
          : "Could not update claim. Please try again.",
      });
      setTimeout(() => {
        setClaimConflict((prev) => (prev?.targetId === targetId ? null : prev));
      }, 5000);
    } finally {
      setClaimingId(null);
    }
  };

  const handleDeleteWish = async (wishId: string) => {
    if (!window.confirm("Are you sure you want to delete this wish?")) return;
    try {
      await deleteWish(wishId);
    } catch (err) {
      console.error("Delete wish error:", err);
    }
  };

  const handleDeleteGiftIdea = async (ideaId: string) => {
    if (!user) return;
    if (
      !window.confirm("Are you sure you want to delete this secret gift idea?")
    )
      return;
    try {
      await deleteGiftIdea(ideaId, user);
    } catch (err) {
      console.error("Delete gift idea error:", err);
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading your wishlist…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // If profile loaded but no family yet → setup screen
  if (!familyLoading && family === null) {
    return (
      <FamilySetupScreen
        error={familyError}
        onFamilyReady={(readyFamilyId) => {
          void loadFamily(readyFamilyId);
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      {/* ── Invite modal ── */}
      {showInviteModal && (
        <Modal
          title="Invite a family member"
          onClose={() => {
            setShowInviteModal(false);
            setInviteEmail("");
            setInviteError(null);
            setInviteSuccess(false);
          }}
        >
          {inviteSuccess ? (
            <div className="modal-body">
              <div className="auth-alert success" role="status">
                Invite sent! The link expires in 2 days.
              </div>
              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => {
                  setInviteSuccess(false);
                  setInviteEmail("");
                }}
              >
                Send another invite
              </button>
            </div>
          ) : (
            <form className="modal-body auth-form" onSubmit={handleInvite}>
              {inviteError && (
                <div className="auth-alert error" role="alert">
                  {inviteError}
                </div>
              )}
              <div className="form-group">
                <label htmlFor="invite-email-input">Email address</label>
                <input
                  id="invite-email-input"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* ── Add child modal ── */}
      {showChildModal && (
        <Modal
          title="Add a child profile"
          onClose={() => {
            setShowChildModal(false);
            setChildName("");
            setChildError(null);
          }}
        >
          <form className="modal-body auth-form" onSubmit={handleAddChild}>
            {childError && (
              <div className="auth-alert error" role="alert">
                {childError}
              </div>
            )}
            <div className="form-group">
              <label htmlFor="child-name-input">Child's name</label>
              <input
                id="child-name-input"
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Sophie"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={addingChild || !childName.trim()}
            >
              {addingChild ? "Adding…" : "Add child"}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Wish creation/edit modal ── */}
      {showWishModal && wishModalTarget && (
        <WishModal
          currentUser={user}
          recipientId={wishModalTarget.recipientId}
          recipientName={wishModalTarget.recipientName}
          existingWish={editingWish}
          currentFamilyId={family?.id ?? ""}
          onClose={() => {
            setShowWishModal(false);
            setEditingWish(null);
            setWishModalTarget(null);
          }}
          onSuccess={async () => {
            setShowWishModal(false);
            setEditingWish(null);
            setWishModalTarget(null);
          }}
        />
      )}

      {/* ── Gift Idea modal ── */}
      {showGiftIdeaModal && selectedMember && family && (
        <GiftIdeaModal
          currentUser={user}
          recipientId={selectedMember.id}
          recipientName={selectedMember.displayName}
          familyId={family.id}
          onClose={() => setShowGiftIdeaModal(false)}
          onSuccess={async () => {
            setShowGiftIdeaModal(false);
          }}
        />
      )}

      {/* ── Family Settings modal ── */}
      {showFamilySettings && family && (
        <FamilySettingsModal
          currentUser={user}
          family={family}
          members={members}
          onClose={() => setShowFamilySettings(false)}
          onMembersUpdated={async () => {
            await refreshMembers();
          }}
          onFamilyDeleted={async () => {
            setShowFamilySettings(false);
            await loadFamily();
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className="sidebar" aria-label="Family navigation">
        <div className="brand">
          <Gift aria-hidden="true" />
          <span>Wishlist</span>
        </div>

        {/* Multi-family switcher */}
        {allUserFamilies.length > 1 && (
          <div style={{ display: "grid", gap: "6px" }}>
            <label
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: "#8fa397",
                letterSpacing: "0.05em",
              }}
            >
              Switch Family
            </label>
            <select
              value={family?.id ?? ""}
              onChange={(e) => void selectFamily(e.target.value)}
              style={{
                background: "#22332c",
                color: "#fff",
                border: "1px solid #364d42",
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            >
              {allUserFamilies.map((fam) => (
                <option key={fam.id} value={fam.id}>
                  {fam.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {isAdmin && (
          <button
            className="primary-action"
            type="button"
            onClick={() => setShowInviteModal(true)}
          >
            <MailPlus aria-hidden="true" />
            Invite
          </button>
        )}

        <nav className="nav-list" aria-label="Main">
          <button
            type="button"
            className={`nav-item ${currentView === "family" ? "active" : ""}`}
            onClick={() => setCurrentView("family")}
          >
            <Users aria-hidden="true" />
            Family
          </button>
          <button
            type="button"
            className={`nav-item ${currentView === "wishes" ? "active" : ""}`}
            onClick={() => setCurrentView("wishes")}
          >
            <ListChecks aria-hidden="true" />
            My wishes
          </button>
          <button
            type="button"
            className={`nav-item ${currentView === "claims" ? "active" : ""}`}
            onClick={() => setCurrentView("claims")}
          >
            <ShieldCheck aria-hidden="true" />
            My claims
          </button>
          <button
            type="button"
            className={`nav-item ${currentView === "invites" ? "active" : ""}`}
            onClick={() => setCurrentView("invites")}
          >
            <Mail aria-hidden="true" />
            Invitations
            {pendingInvites.length > 0 && (
              <span className="nav-badge">{pendingInvites.length}</span>
            )}
          </button>
        </nav>

        <div className="user-profile-bar">
          <div className="user-profile-info">
            <span className="user-profile-name">
              {profile?.displayName || user.displayName || "Family Member"}
            </span>
            <span className="user-profile-email">
              {profile?.email || user.email}
            </span>
          </div>
          <button
            type="button"
            className="sign-out-btn"
            onClick={signOut}
            title="Sign out"
          >
            <LogOut aria-hidden="true" style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </aside>

      {/* ── Workspace ── */}
      <section className="workspace">
        {!isOnline && (
          <div className="offline-banner" role="status">
            <WifiOff aria-hidden="true" style={{ width: 16, height: 16 }} />
            <span>
              Offline - real-time updates are paused and changes will sync when
              reconnected.
            </span>
          </div>
        )}
        {pendingInvites.length > 0 &&
          !dismissedBanner &&
          currentView !== "invites" && (
            <div className="invite-alert-banner" role="status">
              <div className="invite-alert-content">
                <Mail
                  aria-hidden="true"
                  style={{ width: 18, height: 18, color: "#e88080" }}
                />
                <span>
                  You have {pendingInvites.length} pending family invitation
                  {pendingInvites.length > 1 ? "s" : ""}!
                </span>
              </div>
              <div className="invite-alert-actions">
                <button
                  type="button"
                  className="invite-alert-view-btn"
                  onClick={() => setCurrentView("invites")}
                >
                  View & respond
                </button>
                <button
                  type="button"
                  className="invite-alert-dismiss-btn"
                  onClick={() => setDismissedBanner(true)}
                  aria-label="Dismiss banner"
                >
                  <X aria-hidden="true" style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )}

        {currentView === "claims" ? (
          <MyClaimsScreen onBack={() => setCurrentView("family")} />
        ) : currentView === "invites" ? (
          <>
            <InvitationsScreen
              invites={pendingInvites}
              loading={loadingInvites}
              onRefresh={loadPendingInvites}
              onAccept={handleAcceptInvite}
              onReject={handleRejectInvite}
              onBack={() => setCurrentView("family")}
            />

            {/*
            Sent invites table
            TODO: move to a different component and add pagination if needed
            */}
            <section
              className="sent-invites-section"
              style={{ marginTop: "24px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <h2 style={{ margin: 0 }}>Invites You Sent</h2>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: "0.85rem", padding: "4px 8px" }}
                  onClick={() =>
                    void refreshInviteLists(loadPendingInvites, loadSentInvites)
                  }
                  disabled={loadingInvites}
                >
                  {loadingInvites ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {sentInvites.length === 0 ? (
                <p className="sent-invites-empty">
                  You have not sent any invitations.
                </p>
              ) : (
                <table
                  className="sent-invites-table"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #2d4538" }}>
                      <th style={{ textAlign: "left", padding: "8px" }}>
                        Email
                      </th>
                      <th style={{ textAlign: "left", padding: "8px" }}>
                        Family
                      </th>
                      <th style={{ textAlign: "left", padding: "8px" }}>
                        Status
                      </th>
                      <th style={{ textAlign: "left", padding: "8px" }}>
                        Expires
                      </th>
                      <th style={{ textAlign: "left", padding: "8px" }}>
                        Link
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentInvites.map((inv) => {
                      const status = inv.acceptedAt
                        ? "Accepted"
                        : inv.rejectedAt
                          ? "Rejected"
                          : inv.revokedAt
                            ? "Revoked"
                            : new Date(inv.expiresAt) < new Date()
                              ? "Expired"
                              : "Pending";
                      const expiry = new Date(
                        inv.expiresAt,
                      ).toLocaleDateString();
                      const copyLink = async () => {
                        const link = `${window.location.origin}/invite/${inv.id}`;
                        await navigator.clipboard.writeText(link);
                        //TODO: fix this
                        // setActionSuccess(`Link copied for ${inv.email}`);
                      };
                      return (
                        <tr
                          key={inv.id}
                          style={{ borderBottom: "1px solid #2d4538" }}
                        >
                          <td style={{ padding: "8px" }}>{inv.email}</td>
                          <td style={{ padding: "8px" }}>
                            {inv.familyName || "(none)"}
                          </td>
                          <td style={{ padding: "8px" }}>{status}</td>
                          <td style={{ padding: "8px" }}>{expiry}</td>
                          <td style={{ padding: "8px" }}>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{
                                fontSize: "0.85rem",
                                padding: "4px 8px",
                              }}
                              onClick={copyLink}
                            >
                              Copy Link
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </>
        ) : currentView === "wishes" ? (
          /* ── My Wishes tab ── */
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">{family?.name}</p>
                <h1>My wishes</h1>
              </div>
              <button
                type="button"
                className="primary-action"
                style={{ padding: "0 16px" }}
                onClick={() => {
                  setWishModalTarget({
                    recipientId: user.uid,
                    recipientName: "Myself",
                  });
                  setEditingWish(null);
                  setShowWishModal(true);
                }}
              >
                <Plus aria-hidden="true" style={{ width: 16, height: 16 }} />
                New wish
              </button>
            </header>

            {myWishes.length === 0 ? (
              <div className="empty-state">
                <Gift aria-hidden="true" className="empty-gift-icon" />
                <h3>No wishes yet</h3>
                <p>
                  Click "New wish" above to add items you are hoping for this
                  Christmas!
                </p>
              </div>
            ) : (
              <div className="wish-list">
                {myWishes.map((wish) => (
                  <article
                    className="wish-row"
                    key={wish.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{wish.title}</span>
                      {wish.description && (
                        <p className="wish-desc">{wish.description}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="secondary-action"
                        style={{ padding: "4px 8px", minHeight: "32px" }}
                        onClick={() => {
                          setWishModalTarget({
                            recipientId: wish.recipientId,
                            recipientName: "Myself",
                          });
                          setEditingWish(wish);
                          setShowWishModal(true);
                        }}
                        title="Edit wish"
                      >
                        <Edit3 style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "1px solid #e27d7d",
                          color: "#c92a2a",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                        onClick={() => handleDeleteWish(wish.id)}
                        title="Delete wish"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Family tab ── */
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">{family?.name}</p>
                <h1>Christmas wishes</h1>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                {isAdmin && (
                  <button
                    type="button"
                    className="secondary-action"
                    style={{
                      padding: "0 12px",
                      minHeight: "36px",
                      fontSize: "0.88rem",
                    }}
                    onClick={() => setShowFamilySettings(true)}
                  >
                    <Settings
                      style={{ width: 15, height: 15, marginRight: 6 }}
                    />
                    Settings
                  </button>
                )}
                <div className="privacy-pill">
                  <LockKeyhole aria-hidden="true" />
                  Surprise privacy enforced
                </div>
              </div>
            </header>

            {familyError && (
              <div className="auth-alert error" role="alert">
                {familyError}
              </div>
            )}

            {familyLoading ? (
              <div className="loading-container" style={{ minHeight: 200 }}>
                <p>Loading family data…</p>
              </div>
            ) : (
              <>
                {/* ── Metrics ── */}
                <section className="summary-grid" aria-label="Family summary">
                  <div className="metric-card">
                    <span className="metric-value">{members.length}</span>
                    <span className="metric-label">members</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-value">{totalWishes}</span>
                    <span className="metric-label">visible items</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-value">{unclaimed}</span>
                    <span className="metric-label">unclaimed</span>
                  </div>
                </section>

                <div className="content-grid">
                  {/* ── Member list ── */}
                  <section className="panel" id="family">
                    <div className="panel-header">
                      <h2>Family</h2>
                      {isAdmin && (
                        <button
                          className="secondary-action"
                          type="button"
                          onClick={() => setShowChildModal(true)}
                        >
                          <Plus
                            aria-hidden="true"
                            style={{ width: 14, height: 14 }}
                          />
                          Add child
                        </button>
                      )}
                    </div>

                    <div className="member-list">
                      {/* Current user row */}
                      {currentUserMember && (
                        <article
                          className={`member-row member-row--clickable ${selectedMember?.id === currentUserMember.id ? "member-row--selected" : ""}`}
                          key={currentUserMember.id}
                          onClick={() => selectMember(currentUserMember)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) =>
                            e.key === "Enter" && selectMember(currentUserMember)
                          }
                        >
                          <div>
                            <h3>
                              {currentUserMember.displayName}{" "}
                              <span className="you-badge">you</span>
                            </h3>
                            <p>
                              {currentUserMember.admin ? "Admin" : "Member"}
                            </p>
                          </div>
                        </article>
                      )}

                      {otherMembers.map((member) => (
                        <article
                          className={`member-row member-row--clickable ${selectedMember?.id === member.id ? "member-row--selected" : ""}`}
                          key={member.id}
                          onClick={() => selectMember(member)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) =>
                            e.key === "Enter" && selectMember(member)
                          }
                        >
                          <div>
                            <h3>{member.displayName}</h3>
                            <p>
                              {member.kind === "managedChild"
                                ? "Managed child"
                                : member.admin
                                  ? "Admin"
                                  : "Member"}
                            </p>
                          </div>
                        </article>
                      ))}

                      {members.length <= 1 && (
                        <p className="empty-members-hint">
                          No other members yet.
                          {isAdmin ? " Use Invite to add someone." : ""}
                        </p>
                      )}
                    </div>
                  </section>

                  {/* ── Selected member's wishes ── */}
                  <section className="panel" id="wishes">
                    <div
                      className="panel-header"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <h2>
                        {selectedMember
                          ? `${selectedMember.displayName}'s list`
                          : "Select a member"}
                      </h2>
                      {selectedMember && isGuardianOfSelected && (
                        <button
                          className="secondary-action"
                          type="button"
                          style={{
                            padding: "0 10px",
                            minHeight: "32px",
                            fontSize: "0.85rem",
                          }}
                          onClick={() => {
                            setWishModalTarget({
                              recipientId: selectedMember.id,
                              recipientName: selectedMember.displayName,
                            });
                            setEditingWish(null);
                            setShowWishModal(true);
                          }}
                        >
                          <Plus
                            aria-hidden="true"
                            style={{ width: 14, height: 14 }}
                          />
                          Add child wish
                        </button>
                      )}
                      {selectedMember?.id === user.uid && (
                        <button
                          className="secondary-action"
                          type="button"
                          style={{
                            padding: "0 10px",
                            minHeight: "32px",
                            fontSize: "0.85rem",
                          }}
                          onClick={() => {
                            setWishModalTarget({
                              recipientId: user.uid,
                              recipientName: "Myself",
                            });
                            setEditingWish(null);
                            setShowWishModal(true);
                          }}
                        >
                          <Plus
                            aria-hidden="true"
                            style={{ width: 14, height: 14 }}
                          />
                          Add wish
                        </button>
                      )}
                    </div>

                    {!selectedMember ? (
                      <p className="empty-members-hint">
                        Click a family member to see their wishes.
                      </p>
                    ) : dataError ? (
                      <p className="auth-alert error" role="alert">
                        {dataError}
                      </p>
                    ) : wishPanelLoading ? (
                      <p className="empty-members-hint">Loading…</p>
                    ) : memberWishes.length === 0 ? (
                      <p className="empty-members-hint">No wishes yet.</p>
                    ) : (
                      <div className="wish-list">
                        {memberWishes.map((wish) => {
                          const claimKey = `wish_${wish.id}`;
                          const isClaimed = !!claims[claimKey];
                          const isMe =
                            claims[claimKey]?.claimantId === user.uid;
                          const busy = claimingId === claimKey;
                          const canManageWish =
                            selectedMember.id === user.uid ||
                            isGuardianOfSelected;

                          return (
                            <article
                              className="wish-row"
                              key={wish.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600 }}>
                                  {wish.title}
                                </span>
                                {wish.description && (
                                  <p className="wish-desc">
                                    {wish.description}
                                  </p>
                                )}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                {canManageWish && (
                                  <>
                                    <button
                                      type="button"
                                      className="secondary-action"
                                      style={{
                                        padding: "4px 8px",
                                        minHeight: "30px",
                                      }}
                                      onClick={() => {
                                        setWishModalTarget({
                                          recipientId: wish.recipientId,
                                          recipientName:
                                            selectedMember.displayName,
                                        });
                                        setEditingWish(wish);
                                        setShowWishModal(true);
                                      }}
                                      title="Edit wish"
                                    >
                                      <Edit3
                                        style={{ width: 13, height: 13 }}
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      style={{
                                        background: "transparent",
                                        border: "1px solid #e27d7d",
                                        color: "#c92a2a",
                                        borderRadius: "6px",
                                        padding: "4px 8px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                      }}
                                      onClick={() => handleDeleteWish(wish.id)}
                                      title="Delete wish"
                                    >
                                      <Trash2
                                        style={{ width: 13, height: 13 }}
                                      />
                                    </button>
                                  </>
                                )}

                                {claimConflict?.targetId === wish.id && (
                                  <span
                                    className="claim-conflict-notice"
                                    role="alert"
                                  >
                                    {claimConflict.message}
                                  </span>
                                )}

                                {selectedMember.id !== user.uid && (
                                  <button
                                    className={
                                      isClaimed ? "claim claimed" : "claim"
                                    }
                                    type="button"
                                    disabled={busy || (isClaimed && !isMe)}
                                    onClick={() =>
                                      handleClaim(
                                        "wish",
                                        wish.id,
                                        wish.recipientId,
                                      )
                                    }
                                    title={
                                      isClaimed && !isMe
                                        ? "Claimed by someone else"
                                        : undefined
                                    }
                                  >
                                    {busy
                                      ? "…"
                                      : isClaimed
                                        ? isMe
                                          ? "Unclaim"
                                          : "Claimed"
                                        : "Claim"}
                                  </button>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* ── Hidden gift ideas ── */}
                  <section className="panel secret-panel">
                    <div
                      className="panel-header"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <h2>Hidden ideas</h2>
                        {selectedMember && (
                          <span className="hidden-label">
                            Not visible to {selectedMember.displayName}
                          </span>
                        )}
                      </div>
                      {selectedMember && selectedMember.id !== user.uid && (
                        <button
                          className="secondary-action"
                          type="button"
                          style={{
                            padding: "0 10px",
                            minHeight: "32px",
                            fontSize: "0.85rem",
                          }}
                          onClick={() => setShowGiftIdeaModal(true)}
                        >
                          <Plus
                            aria-hidden="true"
                            style={{ width: 14, height: 14 }}
                          />
                          Add idea
                        </button>
                      )}
                    </div>

                    {!selectedMember ? (
                      <p className="empty-members-hint">
                        Select a member first.
                      </p>
                    ) : selectedMember.id === user.uid ? (
                      <p className="empty-members-hint">
                        Surprise privacy: You cannot view secret gift ideas
                        planned for yourself.
                      </p>
                    ) : dataError ? (
                      <p className="auth-alert error" role="alert">
                        {dataError}
                      </p>
                    ) : wishPanelLoading ? (
                      <p className="empty-members-hint">Loading…</p>
                    ) : memberGiftIdeas.length === 0 ? (
                      <p className="empty-members-hint">No hidden ideas yet.</p>
                    ) : (
                      <div className="wish-list">
                        {memberGiftIdeas.map((idea) => {
                          const claimKey = `giftIdea_${idea.id}`;
                          const isClaimed = !!claims[claimKey];
                          const isMe =
                            claims[claimKey]?.claimantId === user.uid;
                          const busy = claimingId === claimKey;
                          const isCreator = idea.creatorId === user.uid;

                          return (
                            <article
                              className="wish-row"
                              key={idea.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600 }}>
                                  {idea.title}
                                </span>
                                {idea.description && (
                                  <p className="wish-desc">
                                    {idea.description}
                                  </p>
                                )}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                {isCreator && (
                                  <button
                                    type="button"
                                    style={{
                                      background: "transparent",
                                      border: "1px solid #e27d7d",
                                      color: "#c92a2a",
                                      borderRadius: "6px",
                                      padding: "4px 8px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                    }}
                                    onClick={() =>
                                      handleDeleteGiftIdea(idea.id)
                                    }
                                    title="Delete gift idea"
                                  >
                                    <Trash2 style={{ width: 13, height: 13 }} />
                                  </button>
                                )}

                                {claimConflict?.targetId === idea.id && (
                                  <span
                                    className="claim-conflict-notice"
                                    role="alert"
                                  >
                                    {claimConflict.message}
                                  </span>
                                )}

                                <button
                                  className={
                                    isClaimed ? "claim claimed" : "claim"
                                  }
                                  type="button"
                                  disabled={busy || (isClaimed && !isMe)}
                                  onClick={() =>
                                    handleClaim(
                                      "giftIdea",
                                      idea.id,
                                      idea.recipientId,
                                    )
                                  }
                                  title={
                                    isClaimed && !isMe
                                      ? "Claimed by someone else"
                                      : undefined
                                  }
                                >
                                  {busy
                                    ? "…"
                                    : isClaimed
                                      ? isMe
                                        ? "Unclaim"
                                        : "Claimed"
                                      : "Claim"}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        )}

        <footer className="status-line">
          Firebase project: <code>{projectId}</code>
        </footer>
      </section>
    </main>
  );
}
