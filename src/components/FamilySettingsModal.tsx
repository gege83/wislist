import { useState } from "react";
import { User } from "firebase/auth";
import { X, Shield, UserMinus, ShieldAlert, Trash2 } from "lucide-react";
import {
  toggleAdminRole,
  removeFamilyMember,
  updateChildGuardians,
  softDeleteFamily,
} from "../lib/families";
import { Family, FamilyMember } from "../types";

interface FamilySettingsModalProps {
  currentUser: User;
  family: Family;
  members: FamilyMember[];
  onClose: () => void;
  onMembersUpdated: () => void;
  onFamilyDeleted: () => void;
}

export function FamilySettingsModal({
  currentUser,
  family,
  members,
  onClose,
  onMembersUpdated,
  onFamilyDeleted,
}: FamilySettingsModalProps) {
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingFamily, setDeletingFamily] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const adultMembers = members.filter((m) => m.kind === "adult");
  const adminCount = adultMembers.filter((m) => m.admin).length;

  const handleToggleAdmin = async (member: FamilyMember) => {
    setError(null);
    setBusyMemberId(member.id);
    try {
      await toggleAdminRole(family.id, member.id, !member.admin, currentUser);
      onMembersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change admin role.");
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemoveMember = async (member: FamilyMember) => {
    if (!window.confirm(`Are you sure you want to remove ${member.displayName} from this family?`)) {
      return;
    }
    setError(null);
    setBusyMemberId(member.id);
    try {
      await removeFamilyMember(family.id, member.id, currentUser);
      onMembersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleToggleGuardian = async (child: FamilyMember, adultId: string) => {
    const currentGuardians = child.guardianIds || [];
    const isCurrentlyGuardian = currentGuardians.includes(adultId);
    let newGuardians: string[];

    if (isCurrentlyGuardian) {
      newGuardians = currentGuardians.filter((id) => id !== adultId);
    } else {
      newGuardians = [...currentGuardians, adultId];
    }

    if (newGuardians.length === 0) {
      setError("A child profile must have at least one guardian.");
      return;
    }

    setError(null);
    setBusyMemberId(child.id);
    try {
      await updateChildGuardians(family.id, child.id, newGuardians, currentUser);
      onMembersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update guardians.");
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleDeleteFamily = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    setDeletingFamily(true);
    try {
      await softDeleteFamily(family.id, currentUser);
      onFamilyDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete family.");
      setDeletingFamily(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Family Settings"
        style={{ maxWidth: "560px", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div className="modal-header">
          <h2>Family Settings: {family.name}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X aria-hidden="true" style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "grid", gap: "20px" }}>
          {error && (
            <div className="auth-alert error" role="alert">
              {error}
            </div>
          )}

          <div>
            <h3 style={{ fontSize: "1rem", margin: "0 0 12px 0" }}>Manage Members</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              {members.map((member) => {
                const isMe = member.id === currentUser.uid;
                const isBusy = busyMemberId === member.id;

                if (member.kind === "adult") {
                  const canDemote = member.admin && adminCount > 1;
                  return (
                    <div
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "#fff",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                      }}
                    >
                      <div>
                        <strong>{member.displayName}</strong> {isMe && <span className="you-badge">you</span>}
                        <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#666" }}>
                          {member.admin ? "Administrator" : "Member"}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="secondary-action"
                          style={{ fontSize: "0.82rem", minHeight: "32px", padding: "0 10px" }}
                          disabled={isBusy || (member.admin && !canDemote)}
                          onClick={() => handleToggleAdmin(member)}
                          title={member.admin && !canDemote ? "Cannot demote the only admin" : undefined}
                        >
                          <Shield style={{ width: 14, height: 14, marginRight: 4 }} />
                          {member.admin ? "Demote" : "Make Admin"}
                        </button>

                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            border: "1px solid #e27d7d",
                            color: "#c92a2a",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            display: "flex",
                            alignItems: "center",
                            fontSize: "0.82rem",
                          }}
                          disabled={isBusy || (member.admin && adminCount <= 1)}
                          onClick={() => handleRemoveMember(member)}
                          title="Remove from family"
                        >
                          <UserMinus style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </div>
                  );
                }

                // Managed Child Profile
                return (
                  <div
                    key={member.id}
                    style={{
                      padding: "12px 14px",
                      background: "#fafafa",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{member.displayName}</strong>
                        <span style={{ marginLeft: 8, fontSize: "0.78rem", background: "#eaeaea", padding: "2px 6px", borderRadius: 4 }}>
                          Child profile
                        </span>
                      </div>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "1px solid #e27d7d",
                          color: "#c92a2a",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          display: "flex",
                          alignItems: "center",
                          fontSize: "0.82rem",
                        }}
                        disabled={isBusy}
                        onClick={() => handleRemoveMember(member)}
                        title="Remove child profile"
                      >
                        <UserMinus style={{ width: 14, height: 14 }} />
                      </button>
                    </div>

                    <div>
                      <span style={{ fontSize: "0.82rem", color: "#555", fontWeight: 600 }}>Guardians:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                        {adultMembers.map((adult) => {
                          const isGuardian = member.guardianIds?.includes(adult.id);
                          return (
                            <label
                              key={adult.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.82rem",
                                padding: "2px 8px",
                                background: isGuardian ? "#e6f4ea" : "#f1f1f1",
                                border: isGuardian ? "1px solid #a8dab5" : "1px solid #dcdcdc",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isGuardian}
                                disabled={isBusy}
                                onChange={() => handleToggleGuardian(member, adult.id)}
                              />
                              {adult.displayName}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #eee",
            }}
          >
            <h4 style={{ color: "#c92a2a", fontSize: "0.95rem", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldAlert style={{ width: 16, height: 16 }} />
              Danger Zone
            </h4>
            <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 10px 0" }}>
              Soft-delete this family. Family members will no longer see it or its wishlists.
            </p>
            {confirmDelete ? (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  style={{
                    background: "#c92a2a",
                    color: "#fff",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: "6px",
                    fontWeight: 600,
                  }}
                  disabled={deletingFamily}
                  onClick={handleDeleteFamily}
                >
                  {deletingFamily ? "Deleting…" : "Confirm Delete Family"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "1px solid #c92a2a",
                  color: "#c92a2a",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onClick={handleDeleteFamily}
              >
                <Trash2 style={{ width: 16, height: 16 }} />
                Delete Family
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
