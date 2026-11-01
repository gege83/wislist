import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getMyClaims } from "../../src/lib/claims";
import { Wish, GiftIdea } from "../../src/types";
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
    projectId: "christmas-wishlist-myclaims-test",
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

describe("My Claims Screen", () => {
  it("lists all wishes and gift ideas claimed by the current user", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smiths",
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

      // Alice's wish claimed by Bob
      await setDoc(doc(db, "wishes/wish1"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Espresso Maker",
        familyId: "fam1",
        status: "available",
      });
      await setDoc(doc(db, "claims/wish_wish1"), {
        targetType: "wish",
        targetId: "wish1",
        recipientId: "alice",
        claimantId: "bob",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      });

      // Gift idea for Alice claimed by Bob
      await setDoc(doc(db, "giftIdeas/idea1"), {
        recipientId: "alice",
        creatorId: "charlie",
        title: "Cooking Class",
        familyId: "fam1",
      });
      await setDoc(doc(db, "claims/giftIdea_idea1"), {
        targetType: "giftIdea",
        targetId: "idea1",
        recipientId: "alice",
        claimantId: "bob",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      });
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();

    // Query claims for Bob
    const claims = await getMyClaims("bob", bobDb);
    expect(claims).toHaveLength(2);

    const targetIds = claims.map((c) => c.targetId);
    expect(targetIds).toContain("wish1");
    expect(targetIds).toContain("idea1");

    // Bob can read target wish and gift idea
    const wishSnap = await getDoc(doc(bobDb, "wishes/wish1"));
    expect(wishSnap.exists()).toBe(true);
    expect((wishSnap.data() as Wish).title).toBe("Espresso Maker");

    const ideaSnap = await getDoc(doc(bobDb, "giftIdeas/idea1"));
    expect(ideaSnap.exists()).toBe(true);
    expect((ideaSnap.data() as GiftIdea).title).toBe("Cooking Class");
  });

  it("deleted claimed wishes remain visible and marked as deleted", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smiths",
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

      // Alice deleted her wish after Bob claimed it
      await setDoc(doc(db, "wishes/wish_deleted"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Vintage Watch",
        familyId: "fam1",
        status: "deleted",
        deletedAt: new Date().toISOString(),
      });
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

    const claims = await getMyClaims("bob", bobDb);
    expect(claims).toHaveLength(1);
    expect(claims[0].targetId).toBe("wish_deleted");

    const wishSnap = await getDoc(doc(bobDb, "wishes/wish_deleted"));
    expect(wishSnap.exists()).toBe(true);
    const wishData = wishSnap.data() as Wish;
    expect(wishData.status).toBe("deleted");
  });

  it("allows claimant to unclaim from My Claims", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "claims/wish_wish1"), {
        targetType: "wish",
        targetId: "wish1",
        recipientId: "alice",
        claimantId: "bob",
        createdAt: new Date().toISOString(),
      });
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();

    // Verify claim exists
    let snap = await getDoc(doc(bobDb, "claims/wish_wish1"));
    expect(snap.exists()).toBe(true);

    // Bob unclaims
    await deleteDoc(doc(bobDb, "claims/wish_wish1"));

    snap = await getDoc(doc(bobDb, "claims/wish_wish1"));
    expect(snap.exists()).toBe(false);
  });
});
