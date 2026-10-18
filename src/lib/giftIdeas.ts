import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebase";
import { GiftIdea } from "../types";

export interface CreateGiftIdeaInput {
  recipientId: string;
  familyId: string;
  title: string;
  description?: string;
}

export async function createGiftIdea(
  input: CreateGiftIdeaInput,
  currentUser: User
): Promise<GiftIdea> {
  if (input.recipientId === currentUser.uid) {
    throw new Error("You cannot add a gift idea for yourself.");
  }

  if (!input.title.trim()) {
    throw new Error("Gift idea title is required.");
  }

  const ideaRef = doc(collection(db, "giftIdeas"));
  const ideaId = ideaRef.id;
  const now = new Date().toISOString();

  const ideaData: GiftIdea = {
    id: ideaId,
    recipientId: input.recipientId,
    creatorId: currentUser.uid,
    title: input.title.trim(),
    description: input.description?.trim() || "",
    familyId: input.familyId,
    createdAt: now,
    deletedAt: null,
  };

  await setDoc(ideaRef, {
    recipientId: ideaData.recipientId,
    creatorId: ideaData.creatorId,
    title: ideaData.title,
    description: ideaData.description,
    familyId: ideaData.familyId,
    createdAt: ideaData.createdAt,
    deletedAt: null,
  });

  return ideaData;
}

export async function getGiftIdeasForRecipient(
  recipientId: string,
  familyId: string,
  currentUserId: string
): Promise<GiftIdea[]> {
  // Surprise privacy: never attempt to query gift ideas if current user is the recipient
  if (recipientId === currentUserId) {
    return [];
  }

  const q = query(
    collection(db, "giftIdeas"),
    where("recipientId", "==", recipientId),
    where("familyId", "==", familyId)
  );

  const snap = await getDocs(q);
  const ideas: GiftIdea[] = [];

  snap.forEach((d) => {
    const data = d.data();
    if (!data.deletedAt) {
      ideas.push({
        id: d.id,
        recipientId: data.recipientId,
        creatorId: data.creatorId,
        title: data.title,
        description: data.description,
        familyId: data.familyId,
        createdAt: data.createdAt,
        deletedAt: data.deletedAt ?? null,
      });
    }
  });

  return ideas;
}

export async function deleteGiftIdea(
  giftIdeaId: string,
  currentUser: User
): Promise<void> {
  const ideaRef = doc(db, "giftIdeas", giftIdeaId);
  const snap = await getDoc(ideaRef);

  if (!snap.exists()) return;
  if (snap.data().creatorId !== currentUser.uid) {
    throw new Error("Only the creator can delete this gift idea.");
  }

  await deleteDoc(ideaRef);
}
