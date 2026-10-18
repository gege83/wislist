import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { normalizeEmail } from "../../src/lib/auth";
import { Family, FamilyMember, Invite } from "../../src/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const rules = readFileSync(
    resolve(process.cwd(), "firestore.rules"),
    "utf8"
  );
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
  it("allows signed-in users without membership to create a family and become initial admin", async () => {
    const userId = "alice_uid";
    const userDb = testEnv
      .authenticatedContext(userId, { email: "alice@example.com" })
      .firestore();

    const familyRef = doc(userDb, "families", "fam_new");
    const memberRef = doc(userDb, "families/fam_new/members", userId);

    // Create family
    await setDoc(familyRef, {
      name: "The Bakers",
      createdBy: userId,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    });

    // Create self as admin member
    await setDoc(memberRef, {
      kind: "adult",
      displayName: "Alice",
      userId,
      admin: true,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      removedAt: null,
    });

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

      // Active invite for Bob
      await setDoc(doc(db, "invites", "inv_bob"), {
        familyId: "fam1",
        email: bobEmail,
        normalizedEmail: normalizeEmail(bobEmail),
        createdBy: "alice",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 100000).toISOString(),
        acceptedAt: null,
        acceptedBy: null,
        revokedAt: null,
      });
    });

    // Bob can read his invite
    const inviteRef = doc(bobDb, "invites", "inv_bob");
    const snap = await getDoc(inviteRef);
    expect(snap.exists()).toBe(true);

    // Bob accepts the invite: updates invite doc and adds self as adult member
    await updateDoc(inviteRef, {
      acceptedAt: new Date().toISOString(),
      acceptedBy: bobId,
    });

    const memberRef = doc(bobDb, "families/fam1/members", bobId);
    await setDoc(memberRef, {
      kind: "adult",
      displayName: "Bob Smith",
      userId: bobId,
      admin: false,
      createdAt: new Date().toISOString(),
      createdBy: bobId,
      removedAt: null,
    });

    const memberSnap = await getDoc(memberRef);
    expect(memberSnap.exists()).toBe(true);
    expect((memberSnap.data() as FamilyMember).userId).toBe(bobId);
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
});
