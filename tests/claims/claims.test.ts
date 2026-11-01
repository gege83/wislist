import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, runTransaction } from "firebase/firestore";
import { Claim, GiftIdea } from "../../src/types";
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
    projectId: "christmas-wishlist-claims-test",
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

describe("Gift Ideas and Claims", () => {
  it("non-recipient adults can add gift ideas for family members, but recipients cannot view them", async () => {
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
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    const ideaRef = doc(bobDb, "giftIdeas/idea_for_alice");

    // Bob creates a gift idea for Alice
    await setDoc(ideaRef, {
      recipientId: "alice",
      creatorId: "bob",
      title: "Handmade Scarf",
      description: "Knitted wool",
      familyId: "fam1",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    });

    // Bob can read the idea
    const bobSnap = await getDoc(ideaRef);
    expect(bobSnap.exists()).toBe(true);
    expect((bobSnap.data() as GiftIdea).title).toBe("Handmade Scarf");

    // Alice (recipient) CANNOT read the gift idea
    await expect(
      getDoc(doc(aliceDb, "giftIdeas/idea_for_alice"))
    ).rejects.toThrow();
  });

  it("users can claim and unclaim wishes and gift ideas", async () => {
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
      await setDoc(doc(db, "wishes/wish1"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Camera",
        familyId: "fam1",
        status: "available",
      });
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const claimRef = doc(bobDb, "claims/wish_wish1");

    // Bob claims Alice's wish
    await setDoc(claimRef, {
      targetType: "wish",
      targetId: "wish1",
      recipientId: "alice",
      claimantId: "bob",
      familyId: "fam1",
      createdAt: new Date().toISOString(),
    });

    let claimSnap = await getDoc(claimRef);
    expect(claimSnap.exists()).toBe(true);
    expect((claimSnap.data() as Claim).claimantId).toBe("bob");

    // Bob unclaims the wish
    await deleteDoc(claimRef);

    claimSnap = await getDoc(claimRef);
    expect(claimSnap.exists()).toBe(false);
  });

  it("claims resolve to one winner via Firestore transactions", async () => {
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
      await setDoc(doc(db, "families/fam1/members/charlie"), {
        kind: "adult",
        userId: "charlie",
      });
      await setDoc(doc(db, "wishes/wish1"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Book",
        familyId: "fam1",
        status: "available",
      });
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();

    const claimWish = async (userDb: typeof bobDb, userId: string) => {
      const claimRef = doc(userDb, "claims/wish_wish1");
      return runTransaction(userDb, async (transaction) => {
        const snap = await transaction.get(claimRef);
        if (snap.exists()) {
          throw new Error("Already claimed");
        }
        transaction.set(claimRef, {
          targetType: "wish",
          targetId: "wish1",
          recipientId: "alice",
          claimantId: userId,
          familyId: "fam1",
          createdAt: new Date().toISOString(),
        });
      });
    };

    // First claimant succeeds
    await expect(claimWish(bobDb, "bob")).resolves.toBeUndefined();

    // Second claimant fails because it is already claimed
    await expect(claimWish(charlieDb, "charlie")).rejects.toThrow(
      "Already claimed"
    );

    // Verify Bob is the sole claimant
    const finalClaim = await getDoc(doc(bobDb, "claims/wish_wish1"));
    expect((finalClaim.data() as Claim).claimantId).toBe("bob");
  });
});
