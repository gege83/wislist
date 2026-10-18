import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { Wish, Claim } from "../../src/types";
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
    projectId: "christmas-wishlist-wishes-test",
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

describe("Wishes", () => {
  it("users can create, edit, and delete their own wishes", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smith Family",
        createdBy: "alice",
      });
      await setDoc(doc(db, "families/fam1/members/alice"), {
        kind: "adult",
        userId: "alice",
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const wishRef = doc(aliceDb, "wishes/wish_alice_1");

    // Alice creates wish
    const wishData: Omit<Wish, "id"> = {
      recipientId: "alice",
      creatorId: "alice",
      title: "Cozy Slippers",
      description: "Size 8, wool lining",
      visibleFamilyIds: ["fam1"],
      status: "available",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    await setDoc(wishRef, wishData);

    let snap = await getDoc(wishRef);
    expect(snap.exists()).toBe(true);
    expect((snap.data() as Wish).title).toBe("Cozy Slippers");

    // Alice edits wish
    await updateDoc(wishRef, {
      title: "Ultra Cozy Slippers",
    });

    snap = await getDoc(wishRef);
    expect((snap.data() as Wish).title).toBe("Ultra Cozy Slippers");

    // Alice soft-deletes wish
    await updateDoc(wishRef, {
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });

    snap = await getDoc(wishRef);
    expect((snap.data() as Wish).status).toBe("deleted");
  });

  it("guardians can create, edit, and delete child wishes", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smith Family",
        createdBy: "alice",
      });
      await setDoc(doc(db, "families/fam1/members/alice"), {
        kind: "adult",
        userId: "alice",
      });
      await setDoc(doc(db, "families/fam1/members/child_timmy"), {
        kind: "managedChild",
        displayName: "Timmy",
        guardianIds: ["alice"],
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const wishRef = doc(aliceDb, "wishes/wish_timmy_1");

    // Alice (guardian) creates wish for Timmy
    await setDoc(wishRef, {
      recipientId: "child_timmy",
      creatorId: "alice",
      title: "Remote Control Car",
      description: "Red color",
      visibleFamilyIds: ["fam1"],
      status: "available",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    });

    let snap = await getDoc(wishRef);
    expect(snap.exists()).toBe(true);
    expect((snap.data() as Wish).recipientId).toBe("child_timmy");

    // Alice updates child wish
    await updateDoc(wishRef, {
      title: "Remote Control Monster Truck",
    });

    snap = await getDoc(wishRef);
    expect((snap.data() as Wish).title).toBe("Remote Control Monster Truck");

    // Alice deletes child wish
    await updateDoc(wishRef, {
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });

    snap = await getDoc(wishRef);
    expect((snap.data() as Wish).status).toBe("deleted");
  });

  it("deleted claimed wishes remain visible to the claimant and are marked removed", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smith Family",
        createdBy: "alice",
      });
      await setDoc(doc(db, "families/fam1/members/alice"), {
        kind: "adult",
        userId: "alice",
      });
      await setDoc(doc(db, "families/fam1/members/bob"), {
        kind: "adult",
        userId: "bob",
      });

      // Wish soft-deleted by Alice
      await setDoc(doc(db, "wishes/wish_deleted"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Old Book",
        visibleFamilyIds: ["fam1"],
        status: "deleted",
        deletedAt: new Date().toISOString(),
      });

      // Claim created by Bob before deletion
      await setDoc(doc(db, "claims/wish_wish_deleted"), {
        targetType: "wish",
        targetId: "wish_deleted",
        recipientId: "alice",
        claimantId: "bob",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      });
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();

    // Bob can read the deleted wish
    const wishSnap = await getDoc(doc(bobDb, "wishes/wish_deleted"));
    expect(wishSnap.exists()).toBe(true);
    const wish = wishSnap.data() as Wish;
    expect(wish.status).toBe("deleted");

    // Bob can read his claim on this wish
    const claimSnap = await getDoc(doc(bobDb, "claims/wish_wish_deleted"));
    expect(claimSnap.exists()).toBe(true);
    const claim = claimSnap.data() as Claim;
    expect(claim.claimantId).toBe("bob");
  });
});
