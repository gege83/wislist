import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { createFirestoreTestEnvironment } from "../helpers/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await createFirestoreTestEnvironment("christmas-wishlist-test");
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

describe("Firestore Security Rules - Core Privacy Model", () => {
  it("recipients cannot read gift ideas for themselves", async () => {
    // Setup family and members
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smith Family",
        createdBy: "alice",
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "families/fam1/members/alice"), {
        kind: "adult",
        displayName: "Alice",
        userId: "alice",
        admin: true,
      });
      await setDoc(doc(db, "families/fam1/members/bob"), {
        kind: "adult",
        displayName: "Bob",
        userId: "bob",
        admin: false,
      });
      await setDoc(doc(db, "giftIdeas/idea1"), {
        recipientId: "alice",
        creatorId: "bob",
        title: "Wool Socks",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      });
    });

    const aliceDb = testEnv
      .authenticatedContext("alice", { email: "alice@example.com" })
      .firestore();
    const bobDb = testEnv
      .authenticatedContext("bob", { email: "bob@example.com" })
      .firestore();

    // Alice (recipient) must not be able to read the hidden gift idea
    await assertFails(getDoc(doc(aliceDb, "giftIdeas/idea1")));

    // Bob (creator & family member) can read it
    await assertSucceeds(getDoc(doc(bobDb, "giftIdeas/idea1")));
  });

  it("recipients cannot read claims targeting their own wishes or gift ideas", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smith Family",
        createdBy: "alice",
      });
      await setDoc(doc(db, "families/fam1/members/alice"), {
        kind: "adult",
        userId: "alice",
        admin: true,
      });
      await setDoc(doc(db, "families/fam1/members/bob"), {
        kind: "adult",
        userId: "bob",
      });
      await setDoc(doc(db, "families/fam1/members/charlie"), {
        kind: "adult",
        userId: "charlie",
      });

      // Wish claim
      await setDoc(doc(db, "claims/wish_wish1"), {
        targetType: "wish",
        targetId: "wish1",
        recipientId: "alice",
        claimantId: "bob",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      });

      // Gift idea claim
      await setDoc(doc(db, "claims/giftIdea_idea1"), {
        targetType: "giftIdea",
        targetId: "idea1",
        recipientId: "alice",
        claimantId: "bob",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();

    // Alice (recipient) cannot read claims targeting her wish or gift idea
    await assertFails(getDoc(doc(aliceDb, "claims/wish_wish1")));
    await assertFails(getDoc(doc(aliceDb, "claims/giftIdea_idea1")));

    // Bob (claimant) can read claims
    await assertSucceeds(getDoc(doc(bobDb, "claims/wish_wish1")));
    await assertSucceeds(getDoc(doc(bobDb, "claims/giftIdea_idea1")));

    // Charlie (other family member) can read claims to coordinate gift giving
    await assertSucceeds(getDoc(doc(charlieDb, "claims/wish_wish1")));
    await assertSucceeds(getDoc(doc(charlieDb, "claims/giftIdea_idea1")));
  });

  it("non-recipient family members can read visible wishes and allowed gift ideas", async () => {
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

      // Another family
      await setDoc(doc(db, "families/fam2"), {
        name: "Jones Family",
        createdBy: "stranger",
      });
      await setDoc(doc(db, "families/fam2/members/stranger"), {
        kind: "adult",
        userId: "stranger",
      });

      // Wish belonging to fam1
      await setDoc(doc(db, "wishes/wish1"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Bicycle",
        status: "available",
        familyId: "fam1",
      });

      // Gift idea in fam1
      await setDoc(doc(db, "giftIdeas/idea1"), {
        recipientId: "alice",
        creatorId: "bob",
        title: "Board Game",
        familyId: "fam1",
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const strangerDb = testEnv.authenticatedContext("stranger").firestore();

    // Alice can read her own wish
    await assertSucceeds(getDoc(doc(aliceDb, "wishes/wish1")));

    // Bob (family member in fam1) can read visible wish
    await assertSucceeds(getDoc(doc(bobDb, "wishes/wish1")));

    // Stranger (not in fam1) cannot read the wish
    await assertFails(getDoc(doc(strangerDb, "wishes/wish1")));

    // Bob can read gift idea for Alice in fam1
    await assertSucceeds(getDoc(doc(bobDb, "giftIdeas/idea1")));

    // Stranger cannot read gift idea for Alice
    await assertFails(getDoc(doc(strangerDb, "giftIdeas/idea1")));
  });

  it("guardians can read gift ideas for managed child profiles they guard", async () => {
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
      // Managed child profile guarded by Alice
      await setDoc(doc(db, "families/fam1/members/child1"), {
        kind: "managedChild",
        displayName: "Timmy",
        guardianIds: ["alice"],
      });

      // Gift idea for child created by Bob
      await setDoc(doc(db, "giftIdeas/idea_child"), {
        recipientId: "child1",
        creatorId: "bob",
        title: "Lego Set",
        familyId: "fam1",
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const outsiderDb = testEnv.authenticatedContext("outsider").firestore();

    // Alice (guardian of child1) can read the gift idea
    await assertSucceeds(getDoc(doc(aliceDb, "giftIdeas/idea_child")));

    // Bob (creator and family member) can read the gift idea
    await assertSucceeds(getDoc(doc(bobDb, "giftIdeas/idea_child")));

    // Outsider cannot read it
    await assertFails(getDoc(doc(outsiderDb, "giftIdeas/idea_child")));
  });

  it("claim creation enforces one active claimant per target", async () => {
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
      await setDoc(doc(db, "families/fam1/members/charlie"), {
        kind: "adult",
        userId: "charlie",
      });
      await setDoc(doc(db, "wishes/wish1"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Headphones",
        familyId: "fam1",
        status: "available",
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();

    // Alice (recipient) cannot claim her own wish
    await assertFails(
      setDoc(doc(aliceDb, "claims/wish_wish1"), {
        targetType: "wish",
        targetId: "wish1",
        recipientId: "alice",
        claimantId: "alice",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      }),
    );

    // Bob successfully claims the wish
    await assertSucceeds(
      setDoc(doc(bobDb, "claims/wish_wish1"), {
        targetType: "wish",
        targetId: "wish1",
        recipientId: "alice",
        claimantId: "bob",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      }),
    );

    // Charlie tries to claim the same wish (update/overwrite existing claim doc) - MUST FAIL
    await assertFails(
      setDoc(doc(charlieDb, "claims/wish_wish1"), {
        targetType: "wish",
        targetId: "wish1",
        recipientId: "alice",
        claimantId: "charlie",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      }),
    );

    // Bob can unclaim (delete his own claim)
    await assertSucceeds(deleteDoc(doc(bobDb, "claims/wish_wish1")));

    // Now Charlie can claim it since it was deleted
    await assertSucceeds(
      setDoc(doc(charlieDb, "claims/wish_wish1"), {
        targetType: "wish",
        targetId: "wish1",
        recipientId: "alice",
        claimantId: "charlie",
        familyId: "fam1",
        createdAt: new Date().toISOString(),
      }),
    );
  });

  it("enforces single family access and immutability on wishes", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smith",
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
      await setDoc(doc(db, "families/fam1/members/exmember"), {
        kind: "adult",
        userId: "exmember",
        removedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "families/fam2"), {
        name: "Jones",
        createdBy: "stranger",
      });
      await setDoc(doc(db, "families/fam2/members/stranger"), {
        kind: "adult",
        userId: "stranger",
      });
      await setDoc(doc(db, "wishes/wish1"), {
        recipientId: "alice",
        creatorId: "alice",
        title: "Book",
        familyId: "fam1",
        status: "available",
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const exDb = testEnv.authenticatedContext("exmember").firestore();
    const strangerDb = testEnv.authenticatedContext("stranger").firestore();

    // Alice and Bob can read
    await assertSucceeds(getDoc(doc(aliceDb, "wishes/wish1")));
    await assertSucceeds(getDoc(doc(bobDb, "wishes/wish1")));

    // Ex-member and stranger cannot read
    await assertFails(getDoc(doc(exDb, "wishes/wish1")));
    await assertFails(getDoc(doc(strangerDb, "wishes/wish1")));

    // Stranger cannot create wish in fam1
    await assertFails(
      setDoc(doc(strangerDb, "wishes/wish2"), {
        recipientId: "stranger",
        creatorId: "stranger",
        title: "Sneakers",
        familyId: "fam1",
        status: "available",
      }),
    );

    // Alice cannot change familyId to fam2
    await assertFails(
      updateDoc(doc(aliceDb, "wishes/wish1"), {
        familyId: "fam2",
      }),
    );

    // Alice can update title
    await assertSucceeds(
      updateDoc(doc(aliceDb, "wishes/wish1"), {
        title: "Cookbook",
      }),
    );
  });
});
