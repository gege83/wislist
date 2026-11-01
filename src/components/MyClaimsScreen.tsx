import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { CheckCircle2, AlertCircle, Gift, ArrowLeft } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/authContext";
import { getMyClaims, unclaimItem, subscribeMyClaims } from "../lib/claims";
import { Claim, Wish, GiftIdea } from "../types";

export interface ClaimWithTarget {
  claim: Claim;
  target: Wish | GiftIdea | null;
  targetExists: boolean;
  isDeletedWish: boolean;
}

interface MyClaimsScreenProps {
  onBack?: () => void;
}

export function MyClaimsScreen({ onBack }: MyClaimsScreenProps) {
  const { user } = useAuth();
  const [claimedItems, setClaimedItems] = useState<ClaimWithTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unclaimingId, setUnclaimingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    setLoading(true);
    const unsub = subscribeMyClaims(
      user.uid,
      async (claims) => {
        try {
          const items: ClaimWithTarget[] = [];

          for (const claim of claims) {
            if (claim.targetType === "wish") {
              const snap = await getDoc(doc(db, "wishes", claim.targetId));
              if (snap.exists()) {
                const wishData = snap.data() as Wish;
                items.push({
                  claim,
                  target: { ...wishData, id: snap.id },
                  targetExists: true,
                  isDeletedWish: wishData.status === "deleted",
                });
              } else {
                items.push({
                  claim,
                  target: null,
                  targetExists: false,
                  isDeletedWish: false,
                });
              }
            } else if (claim.targetType === "giftIdea") {
              const snap = await getDoc(doc(db, "giftIdeas", claim.targetId));
              if (snap.exists()) {
                const ideaData = snap.data() as GiftIdea;
                items.push({
                  claim,
                  target: { ...ideaData, id: snap.id },
                  targetExists: true,
                  isDeletedWish: false,
                });
              } else {
                items.push({
                  claim,
                  target: null,
                  targetExists: false,
                  isDeletedWish: false,
                });
              }
            }
          }

          if (active) {
            setClaimedItems(items);
            setLoading(false);
          }
        } catch (err: unknown) {
          if (active) {
            setError(err instanceof Error ? err.message : "Failed to load claims.");
            setLoading(false);
          }
        }
      },
      (err) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [user]);

  const handleUnclaim = async (claimId: string) => {
    if (!user) return;
    setUnclaimingId(claimId);
    try {
      await unclaimItem(claimId, user);
      setClaimedItems((prev) => prev.filter((item) => item.claim.id !== claimId));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to unclaim item.");
      }
    } finally {
      setUnclaimingId(null);
    }
  };

  return (
    <section className="my-claims-screen">
      <div className="claims-topbar">
        {onBack && (
          <button
            type="button"
            className="secondary-action back-btn"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" style={{ width: 16, height: 16 }} />
            Back to Family
          </button>
        )}
        <div>
          <h2>My Claims</h2>
          <p className="eyebrow" style={{ marginTop: 4 }}>
            Wishes and hidden gift ideas you committed to get
          </p>
        </div>
      </div>

      {error && (
        <div className="auth-alert error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-container" style={{ minHeight: 200 }}>
          <p>Loading your claimed items...</p>
        </div>
      ) : claimedItems.length === 0 ? (
        <div className="empty-claims-state">
          <Gift aria-hidden="true" className="empty-gift-icon" />
          <h3>No gifts claimed yet</h3>
          <p>
            When you claim a wish or a hidden gift idea from a family member's
            list, it will show up here.
          </p>
        </div>
      ) : (
        <div className="claims-list">
          {claimedItems.map(({ claim, target, isDeletedWish, targetExists }) => (
            <article key={claim.id} className="claim-card">
              <div className="claim-card-body">
                <div className="claim-card-header">
                  <span className="claim-type-badge">
                    {claim.targetType === "wish" ? "Wish" : "Gift Idea"}
                  </span>
                  {isDeletedWish && (
                    <span className="deleted-warning-pill">
                      <AlertCircle aria-hidden="true" style={{ width: 14, height: 14 }} />
                      Removed from recipient's list
                    </span>
                  )}
                </div>

                <h3 className="claim-title">
                  {target?.title ?? (targetExists ? "Untitled Item" : "Item no longer exists")}
                </h3>

                {target?.description && (
                  <p className="claim-description">{target.description}</p>
                )}

                <p className="claim-date">
                  Claimed on {new Date(claim.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="claim-card-actions">
                <button
                  type="button"
                  className="unclaim-btn"
                  onClick={() => handleUnclaim(claim.id)}
                  disabled={unclaimingId === claim.id}
                >
                  <CheckCircle2 aria-hidden="true" style={{ width: 16, height: 16 }} />
                  {unclaimingId === claim.id ? "Unclaiming..." : "Unclaim"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
