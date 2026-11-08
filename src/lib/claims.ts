import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  runTransaction,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebase";
import { Claim } from "../types";

function mapClaim(id: string, data: Record<string, unknown>): Claim {
  return {
    id,
    targetType: data.targetType as Claim["targetType"],
    targetId: data.targetId as string,
    recipientId: data.recipientId as string,
    claimantId: data.claimantId as string,
    familyId: data.familyId as string | undefined,
    createdAt: data.createdAt as string,
  };
}

export async function claimItem(
  targetType: "wish" | "giftIdea",
  targetId: string,
  recipientId: string,
  currentUser: User,
  familyId?: string,
): Promise<Claim> {
  if (recipientId === currentUser.uid) {
    throw new Error("You cannot claim an item intended for yourself.");
  }

  const claimId = `${targetType}_${targetId}`;
  const claimRef = doc(db, "claims", claimId);

  return await runTransaction(db, async (transaction) => {
    const claimDoc = await transaction.get(claimRef);
    if (claimDoc.exists()) {
      throw new Error("This item has already been claimed.");
    }

    const claimData: Claim = {
      id: claimId,
      targetType,
      targetId,
      recipientId,
      claimantId: currentUser.uid,
      familyId,
      createdAt: new Date().toISOString(),
    };

    transaction.set(claimRef, claimData);
    return claimData;
  });
}

export async function unclaimItem(
  claimId: string,
  currentUser: User,
): Promise<void> {
  const claimRef = doc(db, "claims", claimId);
  const snap = await getDoc(claimRef);

  if (!snap.exists()) {
    return;
  }

  if (snap.data().claimantId !== currentUser.uid) {
    throw new Error("Only the claimant can unclaim this item.");
  }

  await deleteDoc(claimRef);
}

export async function getClaimsForFamily(
  familyId: string,
  currentUserId: string,
): Promise<Record<string, Claim>> {
  const q = query(collection(db, "claims"), where("familyId", "==", familyId));

  const snap = await getDocs(q);
  const claimsMap: Record<string, Claim> = {};

  snap.forEach((d) => {
    const data = d.data();
    // Surprise privacy: Never expose claims targeting the current user
    if (data.recipientId !== currentUserId) {
      claimsMap[d.id] = mapClaim(d.id, data);
    }
  });

  return claimsMap;
}

export async function getMyClaims(
  userId: string,
  firestoreInstance: Firestore = db,
): Promise<Claim[]> {
  const q = query(
    collection(firestoreInstance, "claims"),
    where("claimantId", "==", userId),
  );

  const snap = await getDocs(q);
  const claims: Claim[] = [];

  snap.forEach((d) => {
    const data = d.data();
    claims.push(mapClaim(d.id, data));
  });

  return claims;
}

export function subscribeClaimsForRecipient(
  familyId: string,
  recipientId: string,
  currentUserId: string,
  onUpdate: (claims: Record<string, Claim>) => void,
  onError?: (err: Error) => void,
  firestoreInstance: Firestore = db,
): () => void {
  // Surprise privacy: Never expose claims targeting the current user
  if (recipientId === currentUserId) {
    onUpdate({});
    return () => {};
  }

  const q = query(
    collection(firestoreInstance, "claims"),
    where("familyId", "==", familyId),
    where("recipientId", "==", recipientId),
  );

  return onSnapshot(
    q,
    (snap) => {
      const claimsMap: Record<string, Claim> = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.recipientId !== currentUserId) {
          claimsMap[d.id] = mapClaim(d.id, data);
        }
      });
      onUpdate(claimsMap);
    },
    (err) => {
      onError?.(err);
    },
  );
}

export function subscribeMyClaims(
  userId: string,
  onUpdate: (claims: Claim[]) => void,
  onError?: (err: Error) => void,
  firestoreInstance: Firestore = db,
): () => void {
  const q = query(
    collection(firestoreInstance, "claims"),
    where("claimantId", "==", userId),
  );

  return onSnapshot(
    q,
    (snap) => {
      const claims: Claim[] = [];
      snap.forEach((d) => {
        const data = d.data();
        claims.push(mapClaim(d.id, data));
      });
      onUpdate(claims);
    },
    (err) => {
      onError?.(err);
    },
  );
}
