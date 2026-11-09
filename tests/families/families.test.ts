import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { normalizeEmail } from "../../src/lib/auth";
import { Family, FamilyMember, Invite } from "../../src/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { acceptInvite, createFamily } from "../../src/lib/families";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: "christmas-wishlist-families-test",
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

describe("Families and Invites", () => {
  it("creates the initial Family Admin and count as one atomic production operation", async () => {
    const userId = "alice_uid";
    const email = "alice@example.com";
    const userDb = testEnv.authenticatedContext(userId, { email }).firestore();
    const profile = {
      displayName: "Alice",
      email,
      normalizedEmail: normalizeEmail(email),
      createdAt: new Date().toISOString(),
      lastSelectedFamilyId: null,
    };
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", userId), profile);
    });

    const family = await createFamily(
      "The Bakers",
      {
        uid: userId,
        email,
        displayName: "Alice",
      } as import("firebase/auth").User,
      profile,
      userDb,
    );
    const savedFamily = await getDoc(doc(userDb, "families", family.id));
    const admin = await getDoc(
      doc(userDb, `families/${family.id}/members/${userId}`),
    );
    const savedProfile = await getDoc(doc(userDb, "users", userId));

    expect(family.adminCount).toBe(1);
    expect(savedFamily.data()?.adminCount).toBe(1);
    expect(admin.data()).toMatchObject({ admin: true, kind: "adult", userId });
    expect(savedProfile.data()?.lastSelectedFamilyId).toBe(family.id);
  });

  it("allows signed-in users without membership to create a family and become initial admin", async () => {
    const userId = "alice_uid";
    const userDb = testEnv
      .authenticatedContext(userId, { email: "alice@example.com" })
      .firestore();

    const familyRef = doc(userDb, "families", "fam_new");
    const memberRef = doc(userDb, "families/fam_new/members", userId);

    const batch = writeBatch(userDb);
    batch.set(familyRef, {
      name: "The Bakers",
      createdBy: userId,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      adminCount: 1,
    });

    batch.set(memberRef, {
      kind: "adult",
      displayName: "Alice",
      userId,
      admin: true,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      removedAt: null,
    });
    await batch.commit();

    const famSnap = await getDoc(familyRef);
    expect(famSnap.exists()).toBe(true);
    expect((famSnap.data() as Family).name).toBe("The Bakers");

    const memberSnap = await getDoc(memberRef);
    expect(memberSnap.exists()).toBe(true);
    expect((memberSnap.data() as FamilyMember).admin).toBe(true);
  });

  it("admins can create email-addressed invites with 2-day expiration", async () => {
    const adminId = "alice_uid";
    const adminDb = testEnv
      .authenticatedContext(adminId, { email: "alice@example.com" })
      .firestore();

    // Setup admin membership
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families", "fam1"), {
        name: "Smiths",
        createdBy: adminId,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "families/fam1/members", adminId), {
        kind: "adult",
        userId: adminId,
        admin: true,
      });
    });

    const inviteRef = doc(adminDb, "invites", "inv_123");
    const now = Date.now();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now + twoDaysMs).toISOString();

    await setDoc(inviteRef, {
      familyId: "fam1",
      email: "Bob@Example.COM",
      normalizedEmail: normalizeEmail("Bob@Example.COM"),
      createdBy: adminId,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      expiresAtTimestamp: Timestamp.fromDate(new Date(expiresAt)),
      acceptedAt: null,
      acceptedBy: null,
      revokedAt: null,
    });

    const snap = await getDoc(inviteRef);
    expect(snap.exists()).toBe(true);
    const invite = snap.data() as Invite;
    expect(invite.normalizedEmail).toBe("bob@example.com");

    const expiryDiff = new Date(invite.expiresAt).getTime() - now;
    expect(expiryDiff).toBeCloseTo(twoDaysMs, -3);
  });

  it("users see active invites addressed to their normalized email and must manually accept", async () => {
    const bobId = "bob_uid";
    const bobEmail = "Bob.Smith@gmail.com";
    const bobDb = testEnv
      .authenticatedContext(bobId, { email: bobEmail })
      .firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families", "fam1"), {
        name: "Smiths",
        createdBy: "alice",
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "families/fam1/members", "alice"), {
        kind: "adult",
        userId: "alice",
        admin: true,
      });
      await setDoc(doc(db, "users", bobId), {
        displayName: "Bob Smith",
        email: bobEmail,
        normalizedEmail: normalizeEmail(bobEmail),
        createdAt: new Date().toISOString(),
        lastSelectedFamilyId: null,
      });

      // Active invite for Bob
      await setDoc(doc(db, "invites", "inv_bob"), {
        familyId: "fam1",
        email: bobEmail,
        normalizedEmail: normalizeEmail(bobEmail),
        createdBy: "alice",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 100000).toISOString(),
        expiresAtTimestamp: Timestamp.fromDate(new Date(Date.now() + 100000)),
        acceptedAt: null,
        acceptedBy: null,
        revokedAt: null,
      });
    });

    // Bob can read his invite
    const inviteRef = doc(bobDb, "invites", "inv_bob");
    const snap = await getDoc(inviteRef);
    expect(snap.exists()).toBe(true);

    // Bob accepts through the production operation so Invite and membership writes are atomic.
    const joinedFamilyId = await acceptInvite(
      "inv_bob",
      {
        uid: bobId,
        email: bobEmail,
        displayName: "Bob Smith",
      } as import("firebase/auth").User,
      {
        displayName: "Bob Smith",
        email: bobEmail,
        normalizedEmail: normalizeEmail(bobEmail),
        createdAt: new Date().toISOString(),
        lastSelectedFamilyId: null,
      },
      bobDb,
    );
    expect(joinedFamilyId).toBe("fam1");

    const memberRef = doc(bobDb, "families/fam1/members", bobId);
    const memberSnap = await getDoc(memberRef);
    expect(memberSnap.exists()).toBe(true);
    expect((memberSnap.data() as FamilyMember).userId).toBe(bobId);
  });

  it("users can reject an invitation and it is recorded as rejected", async () => {
    const charlieId = "charlie_uid";
    const charlieEmail = "Charlie@example.com";
    const charlieDb = testEnv
      .authenticatedContext(charlieId, { email: charlieEmail })
      .firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "invites", "inv_charlie"), {
        familyId: "fam1",
        familyName: "Smiths",
        email: charlieEmail,
        normalizedEmail: normalizeEmail(charlieEmail),
        createdBy: "alice",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 100000).toISOString(),
        expiresAtTimestamp: Timestamp.fromDate(new Date(Date.now() + 100000)),
        acceptedAt: null,
        acceptedBy: null,
        revokedAt: null,
        rejectedAt: null,
        rejectedBy: null,
      });
    });

    const inviteRef = doc(charlieDb, "invites", "inv_charlie");
    const snap = await getDoc(inviteRef);
    expect(snap.exists()).toBe(true);
    expect((snap.data() as Invite).familyName).toBe("Smiths");

    // Charlie rejects the invite
    const now = new Date().toISOString();
    await updateDoc(inviteRef, {
      rejectedAt: now,
      rejectedBy: charlieId,
    });

    const updatedSnap = await getDoc(inviteRef);
    expect((updatedSnap.data() as Invite).rejectedAt).toBe(now);
    expect((updatedSnap.data() as Invite).rejectedBy).toBe(charlieId);
  });

  it("admins can soft-delete families", async () => {
    const adminId = "alice_uid";
    const adminDb = testEnv
      .authenticatedContext(adminId, { email: "alice@example.com" })
      .firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families", "fam1"), {
        name: "Smiths",
        createdBy: adminId,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      });
      await setDoc(doc(db, "families/fam1/members", adminId), {
        kind: "adult",
        userId: adminId,
        admin: true,
      });
    });

    const famRef = doc(adminDb, "families", "fam1");
    await updateDoc(famRef, {
      deletedAt: new Date().toISOString(),
    });

    const snap = await getDoc(famRef);
    expect((snap.data() as Family).deletedAt).not.toBeNull();
  });

  it("allows user to query their memberships across families via collectionGroup", async () => {
    const userId = "charlie_uid";
    const userDb = testEnv
      .authenticatedContext(userId, { email: "charlie@example.com" })
      .firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families", "fam_a"), {
        name: "Alpha",
        createdBy: "someone_else",
        createdAt: new Date().toISOString(),
        deletedAt: null,
      });
      await setDoc(doc(db, "families/fam_a/members", userId), {
        kind: "adult",
        userId,
        displayName: "Charlie",
        admin: false,
        removedAt: null,
      });
    });

    const { collectionGroup, query, where, getDocs } =
      await import("firebase/firestore");
    const q = query(
      collectionGroup(userDb, "members"),
      where("userId", "==", userId),
    );
    const snaps = await getDocs(q);
    expect(snaps.size).toBe(1);
    expect(snaps.docs[0].data().displayName).toBe("Charlie");
  });
});
