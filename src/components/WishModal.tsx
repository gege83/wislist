import { useState } from "react";
import { User } from "firebase/auth";
import { X } from "lucide-react";
import { createWish, updateWish } from "../lib/wishes";
import { Family, Wish } from "../types";

interface WishModalProps {
  currentUser: User;
  recipientId: string;
  recipientName: string;
  existingWish?: Wish | null;
  userFamilies: Family[];
  currentFamilyId: string;
  onClose: () => void;
  onSuccess: (wish: Wish) => void;
}

export function WishModal({
  currentUser,
  recipientId,
  recipientName,
  existingWish,
  userFamilies,
  currentFamilyId,
  onClose,
  onSuccess,
}: WishModalProps) {
  const isEditing = !!existingWish;
  const [title, setTitle] = useState(existingWish?.title ?? "");
  const [description, setDescription] = useState(existingWish?.description ?? "");
  const [visibleFamilies, setVisibleFamilies] = useState<string[]>(
    existingWish?.visibleFamilyIds && existingWish.visibleFamilyIds.length > 0
      ? existingWish.visibleFamilyIds
      : userFamilies.length > 0
      ? userFamilies.map((f) => f.id)
      : [currentFamilyId]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFamily = (famId: string) => {
    setVisibleFamilies((prev) =>
      prev.includes(famId) ? prev.filter((id) => id !== famId) : [...prev, famId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a wish title.");
      return;
    }
    if (visibleFamilies.length === 0) {
      setError("Select at least one family that can see this wish.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing && existingWish) {
        await updateWish(existingWish.id, {
          title: title.trim(),
          description: description.trim(),
          visibleFamilyIds: visibleFamilies,
        });
        onSuccess({
          ...existingWish,
          title: title.trim(),
          description: description.trim(),
          visibleFamilyIds: visibleFamilies,
        });
      } else {
        const newWish = await createWish(
          {
            recipientId,
            title: title.trim(),
            description: description.trim(),
            visibleFamilyIds: visibleFamilies,
          },
          currentUser
        );
        onSuccess(newWish);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save wish.");
      setSaving(false);
    }
  };

  const isSelf = recipientId === currentUser.uid;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Edit wish" : isSelf ? "Add a wish" : `Add wish for ${recipientName}`}
      >
        <div className="modal-header">
          <h2>
            {isEditing
              ? "Edit wish"
              : isSelf
              ? "Add a wish"
              : `Add wish for ${recipientName}`}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X aria-hidden="true" style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <form className="modal-body auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-alert error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="wish-title-input">What are you wishing for?</label>
            <input
              id="wish-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wool sweater, size M"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="wish-desc-input">Description or details (optional)</label>
            <textarea
              id="wish-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Link, color preference, where to find it…"
              rows={3}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontFamily: "inherit",
                fontSize: "0.95rem",
              }}
            />
          </div>

          {userFamilies.length > 1 && (
            <div className="form-group">
              <label>Visible to families</label>
              <div style={{ display: "grid", gap: "8px", marginTop: "4px" }}>
                {userFamilies.map((fam) => (
                  <label
                    key={fam.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleFamilies.includes(fam.id)}
                      onChange={() => toggleFamily(fam.id)}
                    />
                    <span>{fam.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={saving || !title.trim() || visibleFamilies.length === 0}
          >
            {saving ? "Saving…" : isEditing ? "Save changes" : "Add wish"}
          </button>
        </form>
      </div>
    </div>
  );
}
