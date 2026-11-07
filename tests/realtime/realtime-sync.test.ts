import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc, type Firestore } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { subscribeWishesForRecipient } from "../../src/lib/wishes";
import { subscribeGiftIdeasForRecipient } from "../../src/lib/giftIdeas";
import { subscribeClaimsForRecipient, subscribeMyClaims } from "../../src/lib/claims";
import { Wish, GiftIdea, Claim } from "../../src/types";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const rules = readFileSync(
    resolve(process.cwd(), "firestore.rules"),
    "utf8"
  );
  testEnv = await initializeTestEnvironment({
    projectId: "christmas-wishlist-realtime-test",
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

describe("Real-time Synchronization", () => {
  it("immediately pushes added, updated, and deleted wishes to subscribers", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), { name: "Smiths", createdBy: "alice" });
      await setDoc(doc(db, "families/fam1/members/alice"), { kind: "adult", userId: "alice" });
      await setDoc(doc(db, "families/fam1/members/bob"), { kind: "adult", userId: "bob" });
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    const receivedWishes: Wish[][] = [];
    const unsub = subscribeWishesForRecipient(
      "alice",
      "fam1",
      (wishes) => {
        receivedWishes.push(wishes);
      },
      undefined,
      bobDb as unknown as Firestore
    );

    // Initial snapshot should be empty
    await expect.poll(() => receivedWishes.length).toBeGreaterThanOrEqual(1);
    expect(receivedWishes[receivedWishes.length - 1]).toEqual([]);

    // Alice creates a wish
    await setDoc(doc(aliceDb, "wishes/wish1"), {
      recipientId: "alice",
      creatorId: "alice",
      title: "Warm Wool Socks",
      description: "Size 40",
      familyId: "fam1",
      status: "available",
      createdAt: new Date().toISOString(),
    });

    await expect.poll(() => receivedWishes.length).toBeGreaterThanOrEqual(2);
    const latest = receivedWishes[receivedWishes.length - 1];
    expect(latest.length).toBe(1);
    expect(latest[0].title).toBe("Warm Wool Socks");

    // Alice updates her wish
    await updateDoc(doc(aliceDb, "wishes/wish1"), {
      title: "Handmade Wool Socks",
    });

    await expect.poll(() => {
      const current = receivedWishes[receivedWishes.length - 1];
      return current[0]?.title;
    }).toBe("Handmade Wool Socks");

    // Alice soft-deletes the wish
    await updateDoc(doc(aliceDb, "wishes/wish1"), {
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });

    await expect.poll(() => {
      const current = receivedWishes[receivedWishes.length - 1];
      return current.length;
    }).toBe(0);

    unsub();
  });

  it("immediately notifies subscribers of gift ideas while preserving surprise privacy", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), { name: "Smiths", createdBy: "alice" });
      await setDoc(doc(db, "families/fam1/members/alice"), { kind: "adult", userId: "alice" });
      await setDoc(doc(db, "families/fam1/members/bob"), { kind: "adult", userId: "bob" });
      await setDoc(doc(db, "families/fam1/members/charlie"), { kind: "adult", userId: "charlie" });
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();
    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    // Alice (the recipient) must never receive secret gift ideas about herself
    const aliceReceived: GiftIdea[][] = [];
    const aliceUnsub = subscribeGiftIdeasForRecipient(
      "alice",
      "fam1",
      "alice",
      (ideas) => {
        aliceReceived.push(ideas);
      },
      undefined,
      aliceDb as unknown as Firestore
    );
    expect(aliceReceived).toEqual([[]]);
    aliceUnsub();

    // Charlie listens to gift ideas for Alice
    const charlieReceived: GiftIdea[][] = [];
    const charlieUnsub = subscribeGiftIdeasForRecipient(
      "alice",
      "fam1",
      "charlie",
      (ideas) => {
        charlieReceived.push(ideas);
      },
      undefined,
      charlieDb as unknown as Firestore
    );

    await expect.poll(() => charlieReceived.length).toBeGreaterThanOrEqual(1);

    // Bob creates a gift idea for Alice
    await setDoc(doc(bobDb, "giftIdeas/idea1"), {
      recipientId: "alice",
      creatorId: "bob",
      title: "Scarf",
      description: "Knitted",
      familyId: "fam1",
      createdAt: new Date().toISOString(),
    });

    await expect.poll(() => {
      const current = charlieReceived[charlieReceived.length - 1];
      return current.length;
    }).toBe(1);
    expect(charlieReceived[charlieReceived.length - 1][0].title).toBe("Scarf");

    // Bob deletes the gift idea
    await deleteDoc(doc(bobDb, "giftIdeas/idea1"));

    await expect.poll(() => {
      const current = charlieReceived[charlieReceived.length - 1];
      return current.length;
    }).toBe(0);

    charlieUnsub();
  });

  it("immediately updates claim status across screens and enforces surprise privacy", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), { name: "Smiths", createdBy: "alice" });
      await setDoc(doc(db, "families/fam1/members/alice"), { kind: "adult", userId: "alice" });
      await setDoc(doc(db, "families/fam1/members/bob"), { kind: "adult", userId: "bob" });
      await setDoc(doc(db, "families/fam1/members/charlie"), { kind: "adult", userId: "charlie" });
      await setDoc(doc(db, "wishes/wish1"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Board Game",
        familyId: "fam1",
        status: "available",
      });
    });

    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();
    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    // Alice (recipient) must never receive claims targeting herself
    const aliceClaims: Record<string, Claim>[] = [];
    const aliceUnsub = subscribeClaimsForRecipient(
      "fam1",
      "alice",
      "alice",
      (claims) => {
        aliceClaims.push(claims);
      },
      undefined,
      aliceDb as unknown as Firestore
    );
    expect(aliceClaims).toEqual([{}]);
    aliceUnsub();

    // Charlie watches claims for Alice's items
    const charlieClaims: Record<string, Claim>[] = [];
    const charlieUnsub = subscribeClaimsForRecipient(
      "fam1",
      "alice",
      "charlie",
      (claims) => {
        charlieClaims.push(claims);
      },
      undefined,
      charlieDb as unknown as Firestore
    );

    // Bob also tracks his own claims
    const bobMyClaims: Claim[][] = [];
    const bobMyClaimsUnsub = subscribeMyClaims(
      "bob",
      (claims) => {
        bobMyClaims.push(claims);
      },
      undefined,
      bobDb as unknown as Firestore
    );

    await expect.poll(() => charlieClaims.length).toBeGreaterThanOrEqual(1);

    // Bob claims Alice's wish
    await setDoc(doc(bobDb, "claims/wish_wish1"), {
      targetType: "wish",
      targetId: "wish1",
      recipientId: "alice",
      claimantId: "bob",
      familyId: "fam1",
      createdAt: new Date().toISOString(),
    });

    // Charlie sees the claim live immediately
    await expect.poll(() => {
      const current = charlieClaims[charlieClaims.length - 1];
      return current["wish_wish1"]?.claimantId;
    }).toBe("bob");

    // Bob's My Claims updates live immediately
    await expect.poll(() => {
      const current = bobMyClaims[bobMyClaims.length - 1];
      return current.some((c) => c.targetId === "wish1");
    }).toBe(true);

    // Bob unclaims
    await deleteDoc(doc(bobDb, "claims/wish_wish1"));

    // Charlie sees it unclaimed live immediately
    await expect.poll(() => {
      const current = charlieClaims[charlieClaims.length - 1];
      return current["wish_wish1"];
    }).toBeUndefined();

    // Bob's My Claims shows 0 claims live immediately
    await expect.poll(() => {
      const current = bobMyClaims[bobMyClaims.length - 1];
      return current.length;
    }).toBe(0);

    charlieUnsub();
    bobMyClaimsUnsub();
  });
});

