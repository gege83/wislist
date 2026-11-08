import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebase";
import { Wish } from "../types";

function mapWish(id: string, data: Record<string, unknown>): Wish {
  return {
    id,
    recipientId: data.recipientId as string,
    creatorId: data.creatorId as string,
    title: data.title as string,
    description: data.description as string | undefined,
    familyId: data.familyId as string,
    status: data.status as Wish["status"],
    createdAt: data.createdAt as string,
    deletedAt: (data.deletedAt as string | null | undefined) ?? null,
  };
}

export interface CreateWishInput {
  recipientId: string;
  title: string;
  description?: string;
  familyId: string;
}

export async function createWish(
  input: CreateWishInput,
  currentUser: User,
): Promise<Wish> {
  const wishRef = doc(collection(db, "wishes"));
  const wishId = wishRef.id;
  const now = new Date().toISOString();

  if (!input.title.trim()) {
    throw new Error("Wish title is required.");
  }

  if (!input.familyId?.trim()) {
    throw new Error("Wish must belong to a family.");
  }

  const wishData: Wish = {
    id: wishId,
    recipientId: input.recipientId,
    creatorId: currentUser.uid,
    title: input.title.trim(),
    description: input.description?.trim() || "",
    familyId: input.familyId.trim(),
    status: "available",
    createdAt: now,
    deletedAt: null,
  };

  await setDoc(wishRef, {
    recipientId: wishData.recipientId,
    creatorId: wishData.creatorId,
    title: wishData.title,
    description: wishData.description,
    familyId: wishData.familyId,
    status: wishData.status,
    createdAt: wishData.createdAt,
    deletedAt: null,
  });

  return wishData;
}

export async function updateWish(
  wishId: string,
  updates: Partial<Pick<Wish, "title" | "description">>,
): Promise<void> {
  const wishRef = doc(db, "wishes", wishId);
  const patch: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    if (!updates.title.trim()) {
      throw new Error("Wish title cannot be empty.");
    }
    patch.title = updates.title.trim();
  }

  if (updates.description !== undefined) {
    patch.description = updates.description.trim();
  }

  await updateDoc(wishRef, patch);
}

export async function deleteWish(wishId: string): Promise<void> {
  const wishRef = doc(db, "wishes", wishId);
  await updateDoc(wishRef, {
    status: "deleted",
    deletedAt: new Date().toISOString(),
  });
}

export async function getWishesForFamilyMember(
  recipientId: string,
  familyId: string,
): Promise<Wish[]> {
  const q = query(
    collection(db, "wishes"),
    where("recipientId", "==", recipientId),
    where("familyId", "==", familyId),
    where("status", "==", "available"),
  );

  const snap = await getDocs(q);
  const wishes: Wish[] = [];

  snap.forEach((d) => {
    const data = d.data();
    wishes.push(mapWish(d.id, data));
  });

  return wishes;
}

export async function getActiveWishesForRecipient(
  recipientId: string,
  familyId: string,
): Promise<Wish[]> {
  const q = query(
    collection(db, "wishes"),
    where("recipientId", "==", recipientId),
    where("familyId", "==", familyId),
    where("status", "==", "available"),
  );

  const snap = await getDocs(q);
  const wishes: Wish[] = [];

  snap.forEach((d) => {
    const data = d.data();
    wishes.push(mapWish(d.id, data));
  });

  return wishes;
}

export async function getWishById(wishId: string): Promise<Wish | null> {
  const snap = await getDoc(doc(db, "wishes", wishId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return mapWish(snap.id, data);
}

export function subscribeWishesForRecipient(
  recipientId: string,
  familyId: string,
  onUpdate: (wishes: Wish[]) => void,
  onError?: (err: Error) => void,
  firestoreInstance: Firestore = db,
): () => void {
  const q = query(
    collection(firestoreInstance, "wishes"),
    where("recipientId", "==", recipientId),
    where("familyId", "==", familyId),
    where("status", "==", "available"),
  );

  return onSnapshot(
    q,
    (snap) => {
      const wishes: Wish[] = [];
      snap.forEach((d) => {
        const data = d.data();
        wishes.push(mapWish(d.id, data));
      });
      onUpdate(wishes);
    },
    (err) => {
      onError?.(err);
    },
  );
}
