import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  collectionGroup,
  runTransaction,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebase";
import { normalizeEmail } from "./auth";
import { Family, FamilyMember, Invite, UserProfile } from "../types";

export async function createFamily(
  name: string,
  user: User,
  profile: UserProfile,
  firestoreInstance: Firestore = db,
): Promise<Family> {
  const familyRef = doc(collection(firestoreInstance, "families"));
  const familyId = familyRef.id;
  const now = new Date().toISOString();

  const familyData: Family = {
    id: familyId,
    name: name.trim(),
    createdBy: user.uid,
    createdAt: now,
    deletedAt: null,
    adminCount: 1,
  };

  const memberRef = doc(
    firestoreInstance,
    `families/${familyId}/members`,
    user.uid,
  );
  const memberData: FamilyMember = {
    id: user.uid,
    kind: "adult",
    displayName: profile.displayName || user.displayName || "Family Member",
    userId: user.uid,
    admin: true,
    createdAt: now,
    createdBy: user.uid,
    removedAt: null,
  };
  const userRef = doc(firestoreInstance, "users", user.uid);

  await runTransaction(firestoreInstance, async (transaction) => {
    transaction.set(familyRef, {
      name: familyData.name,
      createdBy: familyData.createdBy,
      createdAt: familyData.createdAt,
      deletedAt: null,
      adminCount: 1,
    });
    transaction.set(memberRef, memberData);
    transaction.update(userRef, { lastSelectedFamilyId: familyId });
  });

  return familyData;
}

export async function getFamilyById(
  familyId: string,
  firestoreInstance: Firestore = db,
): Promise<Family | null> {
  const familyDoc = await getDoc(doc(firestoreInstance, "families", familyId));
  if (!familyDoc.exists()) return null;
  const data = familyDoc.data();
  if (data.deletedAt) return null;
  return {
    id: familyDoc.id,
    name: data.name,
    createdBy: data.createdBy,
    createdAt: data.createdAt,
    deletedAt: data.deletedAt ?? null,
    adminCount: data.adminCount,
    adminCountChange: data.adminCountChange,
  };
}

export async function getUserFamilies(
  userId: string,
  knownFamilyId?: string | null,
  firestoreInstance: Firestore = db,
): Promise<Family[]> {
  const familyIds = new Set<string>();
  if (knownFamilyId) {
    familyIds.add(knownFamilyId);
  }

  try {
    // Query all members subcollections across families where userId matches
    const membersQuery = query(
      collectionGroup(firestoreInstance, "members"),
      where("userId", "==", userId),
    );

    const memberSnaps = await getDocs(membersQuery);
    memberSnaps.forEach((snap) => {
      const data = snap.data();
      if (!data.removedAt) {
        // member document is at families/{familyId}/members/{userId}
        const pathParts = snap.ref.path.split("/");
        if (pathParts.length >= 2 && pathParts[0] === "families") {
          familyIds.add(pathParts[1]);
        }
      }
    });
  } catch (err) {
    console.warn(
      "Collection group query failed, checking known family IDs:",
      err,
    );
  }

  const families: Family[] = [];
  for (const familyId of familyIds) {
    const family = await getFamilyById(familyId, firestoreInstance);
    if (family) {
      families.push(family);
    }
  }

  return families;
}

export async function getFamilyMembers(
  familyId: string,
  firestoreInstance: Firestore = db,
): Promise<FamilyMember[]> {
  const membersRef = collection(
    firestoreInstance,
    `families/${familyId}/members`,
  );
  const snap = await getDocs(membersRef);
  const members: FamilyMember[] = [];

  snap.forEach((d) => {
    const data = d.data();
    if (!data.removedAt) {
      members.push({
        id: d.id,
        kind: data.kind,
        displayName: data.displayName,
        userId: data.userId,
        admin: data.admin,
        guardianIds: data.guardianIds,
        joinedByInviteId: data.joinedByInviteId,
        createdAt: data.createdAt,
        createdBy: data.createdBy,
        removedAt: data.removedAt ?? null,
      });
    }
  });

  return members;
}

export async function createInvite(
  familyId: string,
  email: string,
  currentUser: User,
  familyName?: string,
): Promise<Invite> {
  const inviteRef = doc(collection(db, "invites"));
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 2 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const inviteData: Invite = {
    id: inviteRef.id,
    familyId,
    ...(familyName ? { familyName: familyName.trim() } : {}),
    email: email.trim(),
    normalizedEmail,
    createdBy: currentUser.uid,
    createdAt: now.toISOString(),
    expiresAt,
    expiresAtTimestamp: Timestamp.fromDate(new Date(expiresAt)),
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
    rejectedAt: null,
    rejectedBy: null,
  };

  await setDoc(inviteRef, inviteData);
  return inviteData;
}

export async function getPendingInvitesForEmail(
  email: string,
): Promise<Invite[]> {
  const normalized = normalizeEmail(email);
  const q = query(
    collection(db, "invites"),
    where("normalizedEmail", "==", normalized),
  );

  const snaps = await getDocs(q);
  const invites: Invite[] = [];
  const now = new Date();

  snaps.forEach((d) => {
    const data = d.data() as Invite;
    if (
      !data.acceptedAt &&
      !data.revokedAt &&
      !data.rejectedAt &&
      new Date(data.expiresAt) > now
    ) {
      invites.push({ ...data, id: d.id });
    }
  });

  return invites;
}

/**
 * Retrieve all invites created by a specific user.
 * Returns all invites regardless of status.
 */
export async function getSentInvitesForUser(userId: string): Promise<Invite[]> {
  const q = query(collection(db, "invites"), where("createdBy", "==", userId));
  const snaps = await getDocs(q);
  const invites: Invite[] = [];
  snaps.forEach((d) => {
    const data = d.data() as Invite;
    invites.push({ ...data, id: d.id });
  });
  return invites;
}

export async function rejectInvite(
  inviteId: string,
  user: User,
): Promise<void> {
  const inviteRef = doc(db, "invites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error("Invite not found");
  }

  const invite = inviteSnap.data() as Invite;
  const userNormalized = normalizeEmail(user.email || "");

  if (invite.normalizedEmail !== userNormalized) {
    throw new Error("This invite was sent to a different email address.");
  }

  if (invite.acceptedAt) {
    throw new Error("This invite has already been accepted.");
  }

  if (invite.rejectedAt) {
    throw new Error("This invite has already been rejected.");
  }

  if (invite.revokedAt) {
    throw new Error("This invite has been revoked.");
  }

  const now = new Date().toISOString();

  await updateDoc(inviteRef, {
    rejectedAt: now,
    rejectedBy: user.uid,
  });
}

export async function acceptInvite(
  inviteId: string,
  user: User,
  profile: UserProfile,
  firestoreInstance: Firestore = db,
): Promise<string> {
  const inviteRef = doc(firestoreInstance, "invites", inviteId);

  return await runTransaction(firestoreInstance, async (transaction) => {
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error("Invite not found");
    }

    const invite = inviteSnap.data() as Invite;
    const userNormalized = normalizeEmail(user.email || "");

    if (invite.normalizedEmail !== userNormalized) {
      throw new Error("This invite was sent to a different email address.");
    }

    if (invite.acceptedAt) {
      throw new Error("This invite has already been accepted.");
    }

    if (invite.revokedAt) {
      throw new Error("This invite has been revoked.");
    }

    if (invite.rejectedAt) {
      throw new Error("This invite has already been rejected.");
    }

    if (new Date(invite.expiresAt) <= new Date()) {
      throw new Error("This invite has expired.");
    }

    const memberRef = doc(
      firestoreInstance,
      `families/${invite.familyId}/members`,
      user.uid,
    );
    const memberSnap = await transaction.get(memberRef);
    if (memberSnap.exists() && !memberSnap.data().removedAt) {
      throw new Error("You are already a member of this family.");
    }

    const now = new Date().toISOString();
    transaction.update(inviteRef, {
      acceptedAt: now,
      acceptedBy: user.uid,
    });
    transaction.set(memberRef, {
      kind: "adult",
      displayName: profile.displayName || user.displayName || "Family Member",
      userId: user.uid,
      admin: false,
      joinedByInviteId: inviteId,
      createdAt: now,
      createdBy: user.uid,
      removedAt: null,
    });
    transaction.update(doc(firestoreInstance, "users", user.uid), {
      lastSelectedFamilyId: invite.familyId,
    });

    return invite.familyId;
  });
}

export async function softDeleteFamily(
  familyId: string,
  currentUser: User,
): Promise<void> {
  // Ensure user is admin
  const memberRef = doc(db, `families/${familyId}/members`, currentUser.uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists() || !memberSnap.data()?.admin) {
    throw new Error("Only an admin can delete the family.");
  }

  const familyRef = doc(db, "families", familyId);
  await updateDoc(familyRef, {
    deletedAt: new Date().toISOString(),
  });
}

export async function removeFamilyMember(
  familyId: string,
  targetMemberId: string,
  currentUser: User,
  firestoreInstance: Firestore = db,
): Promise<void> {
  const familyRef = doc(firestoreInstance, "families", familyId);
  const targetRef = doc(
    firestoreInstance,
    `families/${familyId}/members`,
    targetMemberId,
  );
  const currentRef = doc(
    firestoreInstance,
    `families/${familyId}/members`,
    currentUser.uid,
  );
  await runTransaction(firestoreInstance, async (transaction) => {
    const [familySnap, targetSnap, currentSnap] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(targetRef),
      transaction.get(currentRef),
    ]);
    if (
      !familySnap.exists() ||
      !targetSnap.exists() ||
      targetSnap.data().removedAt
    ) {
      throw new Error("Member not found in family.");
    }
    const isSelf = targetMemberId === currentUser.uid;
    if (
      !isSelf &&
      (!currentSnap.exists() ||
        currentSnap.data().admin !== true ||
        currentSnap.data().removedAt)
    ) {
      throw new Error("Only admins can remove other family members.");
    }
    const target = targetSnap.data();
    const family = familySnap.data();
    const wasAdmin = target.admin === true && !target.removedAt;
    const updates: Record<string, unknown> = {
      removedAt: new Date().toISOString(),
    };
    if (wasAdmin) {
      const adminCount = family.adminCount;
      if (typeof adminCount !== "number") {
        throw new Error(
          "Family Admin count must be migrated before changing Admin membership.",
        );
      }
      if (adminCount <= 1) {
        throw new Error("Cannot remove the last admin from a family.");
      }
      transaction.update(familyRef, {
        adminCount: adminCount - 1,
        adminCountChange: {
          memberId: targetMemberId,
          revision: crypto.randomUUID(),
        },
      });
    }
    transaction.update(targetRef, updates);
  });
}

export async function toggleAdminRole(
  familyId: string,
  targetMemberId: string,
  newAdminState: boolean,
  currentUser: User,
  firestoreInstance: Firestore = db,
): Promise<void> {
  const familyRef = doc(firestoreInstance, "families", familyId);
  const targetRef = doc(
    firestoreInstance,
    `families/${familyId}/members`,
    targetMemberId,
  );
  const currentRef = doc(
    firestoreInstance,
    `families/${familyId}/members`,
    currentUser.uid,
  );
  await runTransaction(firestoreInstance, async (transaction) => {
    const [familySnap, targetSnap, currentSnap] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(targetRef),
      transaction.get(currentRef),
    ]);
    if (
      !currentSnap.exists() ||
      currentSnap.data().admin !== true ||
      currentSnap.data().removedAt
    ) {
      throw new Error("Only admins can manage roles.");
    }
    if (!familySnap.exists()) {
      throw new Error("Family not found.");
    }
    if (!targetSnap.exists() || targetSnap.data().removedAt) {
      throw new Error("Member not found in family.");
    }
    const target = targetSnap.data();
    if (target.kind !== "adult") {
      throw new Error("Only adult Family Members can have Admin access.");
    }
    if (Boolean(target.admin) === newAdminState) return;
    const family = familySnap.data();
    const adminCount = family.adminCount;
    if (typeof adminCount !== "number") {
      throw new Error(
        "Family Admin count must be migrated before changing Admin membership.",
      );
    }
    if (!newAdminState && adminCount <= 1) {
      throw new Error(
        "Cannot demote the last admin. Families require at least one admin.",
      );
    }
    transaction.update(targetRef, { admin: newAdminState });
    transaction.update(familyRef, {
      adminCount: adminCount + (newAdminState ? 1 : -1),
      adminCountChange: {
        memberId: targetMemberId,
        revision: crypto.randomUUID(),
      },
    });
  });
}

export async function createManagedChildProfile(
  familyId: string,
  displayName: string,
  currentUser: User,
  initialGuardianIds?: string[],
  firestoreInstance: Firestore = db,
): Promise<FamilyMember> {
  const childRef = doc(
    collection(firestoreInstance, `families/${familyId}/members`),
  );
  const childId = childRef.id;
  const now = new Date().toISOString();

  const guardianIds =
    initialGuardianIds && initialGuardianIds.length > 0
      ? initialGuardianIds
      : [currentUser.uid];
  if (guardianIds.length !== 1 || guardianIds[0] !== currentUser.uid) {
    throw new Error(
      "A new managed child must start with its creating Admin as Guardian.",
    );
  }

  const childData: FamilyMember = {
    id: childId,
    kind: "managedChild",
    displayName: displayName.trim(),
    guardianIds,
    createdAt: now,
    createdBy: currentUser.uid,
    removedAt: null,
  };

  await setDoc(childRef, childData);
  return childData;
}

export async function updateChildGuardians(
  familyId: string,
  childMemberId: string,
  newGuardianIds: string[],
  currentUser: User,
  firestoreInstance: Firestore = db,
): Promise<void> {
  const members = await getFamilyMembers(familyId, firestoreInstance);
  const currentMember = members.find((m) => m.id === currentUser.uid);
  const childMember = members.find((m) => m.id === childMemberId);

  if (!childMember || childMember.kind !== "managedChild") {
    throw new Error("Managed child profile not found.");
  }

  const isGuardian = childMember.guardianIds?.includes(currentUser.uid);
  const isAdmin = currentMember?.admin;

  if (!isGuardian && !isAdmin) {
    throw new Error(
      "Only admins and existing guardians can manage child guardians.",
    );
  }

  if (newGuardianIds.length === 0) {
    throw new Error("A child profile must have at least one guardian.");
  }

  const addedGuardianIds = newGuardianIds.filter(
    (guardianId) => !childMember.guardianIds?.includes(guardianId),
  );
  if (addedGuardianIds.length > 1) {
    throw new Error("Add Guardian access one Family Member at a time.");
  }

  const childRef = doc(
    firestoreInstance,
    `families/${familyId}/members`,
    childMemberId,
  );
  await updateDoc(childRef, {
    guardianIds: newGuardianIds,
    ...(addedGuardianIds.length === 1
      ? {
          guardianChange: {
            guardianId: addedGuardianIds[0],
            revision: crypto.randomUUID(),
          },
        }
      : {}),
  });
}
