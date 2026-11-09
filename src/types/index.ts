import type { Timestamp } from "firebase/firestore";

export interface UserProfile {
  displayName: string;
  email: string;
  normalizedEmail: string;
  createdAt: string;
  lastSelectedFamilyId: string | null;
}

export type MemberKind = "adult" | "managedChild";

export interface FamilyMember {
  id: string;
  kind: MemberKind;
  displayName: string;
  userId?: string;
  admin?: boolean;
  guardianIds?: string[];
  guardianChange?: { guardianId: string; revision: string };
  joinedByInviteId?: string;
  createdAt: string;
  createdBy: string;
  removedAt?: string | null;
}

export interface Family {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  deletedAt?: string | null;
  adminCount?: number;
  adminCountChange?: { memberId: string; revision: string };
}

export interface Invite {
  id: string;
  familyId: string;
  familyName?: string;
  email: string;
  normalizedEmail: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  expiresAtTimestamp?: Timestamp;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  revokedAt?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
}

export interface Wish {
  id: string;
  recipientId: string;
  creatorId: string;
  familyId: string;
  title: string;
  description?: string;
  status: "available" | "deleted";
  createdAt: string;
  deletedAt?: string | null;
}

export interface GiftIdea {
  id: string;
  recipientId: string;
  creatorId: string;
  title: string;
  description?: string;
  familyId: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Claim {
  id: string;
  targetType: "wish" | "giftIdea";
  targetId: string;
  recipientId: string;
  claimantId: string;
  familyId?: string;
  createdAt: string;
}
