import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeApp } from "firebase-admin/app";
import {
  getFirestore as getAdminFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { doc, setDoc } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { createFirestoreTestEnvironment } from "../helpers/firestore";
import { migrateFamilyAdminCounts } from "../../scripts/migrate-family-admin-count.mjs";
import { toggleAdminRole } from "../../src/lib/families";
import type { User } from "firebase/auth";

const projectId = "wishlist-admin-count-migration-test";
let testEnv: RulesTestEnvironment;
let adminApp: ReturnType<typeof initializeApp>;
let adminFirestore: ReturnType<typeof getAdminFirestore>;

beforeAll(async () => {
  testEnv = await createFirestoreTestEnvironment(projectId);
  adminApp = initializeApp({ projectId }, "admin-count-migration-test");
  adminFirestore = getAdminFirestore(adminApp);
});

afterAll(async () => {
  await testEnv?.cleanup();
  await adminApp?.delete();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Family Admin count migration", () => {
  it("initializes existing counts from active Admin records and adds Invite expiry timestamps", async () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "families/legacy"), {
        name: "Legacy Family",
        createdBy: "alice",
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(firestore, "families/legacy/members/alice"), {
        kind: "adult",
        userId: "alice",
        admin: true,
        removedAt: null,
      });
      await setDoc(doc(firestore, "families/legacy/members/bob"), {
        kind: "adult",
        userId: "bob",
        admin: false,
        removedAt: null,
      });
      await setDoc(doc(firestore, "families/legacy/members/carol"), {
        kind: "adult",
        userId: "carol",
        admin: true,
        removedAt: null,
      });
      await setDoc(doc(firestore, "families/legacy/members/removed-admin"), {
        kind: "adult",
        userId: "removed-admin",
        admin: true,
        removedAt: new Date().toISOString(),
      });
      await setDoc(doc(firestore, "invites/legacy-invite"), {
        familyId: "legacy",
        expiresAt,
        acceptedAt: null,
        revokedAt: null,
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await expect(
      toggleAdminRole("legacy", "bob", true, { uid: "alice" } as User, aliceDb),
    ).rejects.toThrow(/migrated/i);

    const result = await migrateFamilyAdminCounts(adminFirestore);
    expect(result).toEqual({ migrated: 1, expiryFieldsMigrated: 1 });

    const family = await adminFirestore.doc("families/legacy").get();
    expect(family.data()?.adminCount).toBe(2);
    const invite = await adminFirestore.doc("invites/legacy-invite").get();
    expect(invite.data()?.expiresAtTimestamp).toBeInstanceOf(Timestamp);
    expect(
      (invite.data()?.expiresAtTimestamp as Timestamp).toDate().toISOString(),
    ).toBe(expiresAt);

    await toggleAdminRole(
      "legacy",
      "bob",
      true,
      { uid: "alice" } as User,
      aliceDb,
    );
    expect(
      (await adminFirestore.doc("families/legacy").get()).data()?.adminCount,
    ).toBe(3);
  });

  it("stops without writing when a legacy Family has no active Admin", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "families/no-admin"), {
        name: "Broken Family",
        createdBy: "alice",
      });
      await setDoc(doc(firestore, "families/no-admin/members/alice"), {
        kind: "adult",
        userId: "alice",
        admin: true,
        removedAt: new Date().toISOString(),
      });
    });

    await expect(migrateFamilyAdminCounts(adminFirestore)).rejects.toThrow(
      /no active Admin/i,
    );
    const family = await adminFirestore.doc("families/no-admin").get();
    expect(family.data()).not.toHaveProperty("adminCount");
  });
});
