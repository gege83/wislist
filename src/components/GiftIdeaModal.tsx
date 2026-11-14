import { useState } from "react";
import { User } from "firebase/auth";
import { X, LockKeyhole } from "lucide-react";
import { createGiftIdea } from "../lib/giftIdeas";
import { GiftIdea } from "../types";
import { useFirestore } from "../context/firebaseContext";

interface GiftIdeaModalProps {
  currentUser: User;
  recipientId: string;
  recipientName: string;
  familyId: string;
  onClose: () => void;
  onSuccess: (idea: GiftIdea) => void;
}

export function GiftIdeaModal({
  currentUser,
  recipientId,
  recipientName,
  familyId,
  onClose,
  onSuccess,
}: GiftIdeaModalProps) {
  const db = useFirestore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a gift idea title.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const newIdea = await createGiftIdea(
        {
          recipientId,
          familyId,
          title: title.trim(),
          description: description.trim(),
        },
        currentUser,
        db,
      );
      onSuccess(newIdea);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add gift idea.");
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Add secret gift idea for ${recipientName}`}
      >
        <div className="modal-header">
          <h2>Add secret gift idea</h2>
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              background: "#edf7ee",
              border: "1px solid #b7deb9",
              borderRadius: "8px",
              fontSize: "0.88rem",
              color: "#1e4620",
            }}
          >
            <LockKeyhole style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>
              This will be hidden from <strong>{recipientName}</strong> and only
              visible to other family members.
            </span>
          </div>

          {error && (
            <div className="auth-alert error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="idea-title-input">Gift idea</label>
            <input
              id="idea-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Board game, Book subscription…"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="idea-desc-input">Notes or link (optional)</label>
            <textarea
              id="idea-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Store link, sizing notes, or why they'd like it…"
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

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={saving || !title.trim()}
          >
            {saving ? "Saving…" : "Save gift idea"}
          </button>
        </form>
      </div>
    </div>
  );
}
