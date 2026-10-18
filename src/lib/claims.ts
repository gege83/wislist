import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  runTransaction,
  type Firestore,
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebase";
import { Claim } from "../types";

export async function claimItem(
  targetType: "wish" | "giftIdea",
  targetId: string,
  recipientId: string,
  currentUser: User,
  familyId?: string
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
  currentUser: User
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
  currentUserId: string
): Promise<Record<string, Claim>> {
  const q = query(
    collection(db, "claims"),
    where("familyId", "==", familyId)
  );

  const snap = await getDocs(q);
  const claimsMap: Record<string, Claim> = {};

  snap.forEach((d) => {
    const data = d.data();
    // Surprise privacy: Never expose claims targeting the current user
    if (data.recipientId !== currentUserId) {
      claimsMap[d.id] = {
        id: d.id,
        targetType: data.targetType,
        targetId: data.targetId,
        recipientId: data.recipientId,
        claimantId: data.claimantId,
        familyId: data.familyId,
        createdAt: data.createdAt,
      };
    }
  });

  return claimsMap;
}

export async function getMyClaims(
  userId: string,
  firestoreInstance: Firestore = db
): Promise<Claim[]> {
  const q = query(
    collection(firestoreInstance, "claims"),
    where("claimantId", "==", userId)
  );

  const snap = await getDocs(q);
  const claims: Claim[] = [];

  snap.forEach((d) => {
    const data = d.data();
    claims.push({
      id: d.id,
      targetType: data.targetType,
      targetId: data.targetId,
      recipientId: data.recipientId,
      claimantId: data.claimantId,
      familyId: data.familyId,
      createdAt: data.createdAt,
    });
  });

  return claims;
}
