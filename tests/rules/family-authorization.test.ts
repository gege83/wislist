import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import {
  removeFamilyMember,
  toggleAdminRole,
  updateChildGuardians,
} from "../../src/lib/families";
import {
  createFirestoreTestEnvironment,
  seedFamilyFixture,
} from "../helpers/firestore";

let testEnv: RulesTestEnvironment;
const familyId = "family-auth";
const makeUser = (uid: string, email = `${uid}@example.com`) =>
  ({ uid, email }) as User;

async function seedFamily(
  members: Parameters<typeof seedFamilyFixture>[2] = [
    { id: "alice", admin: true },
    { id: "bob" },
    { id: "charlie" },
  ],
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedFamilyFixture(context.firestore(), familyId, members);
  });
}

async function readFamily() {
  let family: Record<string, unknown> | undefined;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(
      doc(context.firestore(), `families/${familyId}`),
    );
    family = snapshot.data();
  });
  return family;
}

async function readMember(memberId: string) {
  let member: Record<string, unknown> | undefined;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(
      doc(context.firestore(), `families/${familyId}/members/${memberId}`),
    );
    member = snapshot.data();
  });
  return member;
}

beforeAll(async () => {
  testEnv = await createFirestoreTestEnvironment(
    "wishlist-family-authorization-test",
  );
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Family Admin authorization", () => {
  it("allows Admin setting changes and rejects count-only changes or member role escalation", async () => {
    await seedFamily();
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(
      updateDoc(doc(aliceDb, `families/${familyId}`), {
        name: "Updated Family",
      }),
    );
    await assertFails(
      updateDoc(doc(bobDb, `families/${familyId}`), { name: "Unauthorized" }),
    );
    await assertFails(
      updateDoc(doc(aliceDb, `families/${familyId}`), { adminCount: 9 }),
    );
    await assertFails(
      updateDoc(doc(bobDb, `families/${familyId}/members/bob`), {
        admin: true,
      }),
    );
    expect((await readFamily())?.adminCount).toBe(1);
    expect((await readMember("bob"))?.admin).toBe(false);
  });

  it("updates Admin role and Admin count together through the production operation", async () => {
    await seedFamily();
    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    await toggleAdminRole(familyId, "bob", true, makeUser("alice"), aliceDb);
    expect((await readMember("bob"))?.admin).toBe(true);
    expect((await readFamily())?.adminCount).toBe(2);

    await toggleAdminRole(familyId, "bob", false, makeUser("alice"), aliceDb);
    expect((await readMember("bob"))?.admin).toBe(false);
    expect((await readFamily())?.adminCount).toBe(1);
  });

  it("permits only Admins to create and revoke Invites", async () => {
    await seedFamily();
    const aliceDb = testEnv
      .authenticatedContext("alice", { email: "alice@example.com" })
      .firestore();
    const bobDb = testEnv
      .authenticatedContext("bob", { email: "bob@example.com" })
      .firestore();
    const invite = {
      familyId,
      email: "new-member@example.com",
      normalizedEmail: "new-member@example.com",
      createdBy: "alice",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      expiresAtTimestamp: Timestamp.fromDate(new Date(Date.now() + 86_400_000)),
      acceptedAt: null,
      acceptedBy: null,
      revokedAt: null,
      rejectedAt: null,
      rejectedBy: null,
    };
    await assertFails(
      setDoc(doc(bobDb, "invites/bob-created"), {
        ...invite,
        createdBy: "bob",
      }),
    );
    await assertSucceeds(setDoc(doc(aliceDb, "invites/alice-created"), invite));
    await assertFails(
      updateDoc(doc(bobDb, "invites/alice-created"), {
        revokedAt: new Date().toISOString(),
        revokedBy: "bob",
      }),
    );
    await assertSucceeds(
      updateDoc(doc(aliceDb, "invites/alice-created"), {
        revokedAt: new Date().toISOString(),
        revokedBy: "alice",
      }),
    );
  });

  it("serializes concurrent Admin demotions so one active Admin remains", async () => {
    await seedFamily([
      { id: "alice", admin: true },
      { id: "bob", admin: true },
    ]);
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const outcomes = await Promise.allSettled([
      toggleAdminRole(familyId, "bob", false, makeUser("alice"), aliceDb),
      toggleAdminRole(familyId, "alice", false, makeUser("bob"), bobDb),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
    expect((await readFamily())?.adminCount).toBe(1);
    const activeAdmins = [
      await readMember("alice"),
      await readMember("bob"),
    ].filter((member) => member?.admin === true && member.removedAt == null);
    expect(activeAdmins).toHaveLength(1);
  });

  it("blocks demoting or removing the last Admin, and allows an authorized self-removal", async () => {
    await seedFamily([{ id: "alice", admin: true }]);
    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    await expect(
      toggleAdminRole(familyId, "alice", false, makeUser("alice"), aliceDb),
    ).rejects.toThrow(/last admin/i);
    await expect(
      removeFamilyMember(familyId, "alice", makeUser("alice"), aliceDb),
    ).rejects.toThrow(/last admin/i);
    expect((await readFamily())?.adminCount).toBe(1);

    await seedFamily([
      { id: "alice", admin: true },
      { id: "bob", admin: true },
    ]);
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    await removeFamilyMember(familyId, "bob", makeUser("bob"), bobDb);
    expect((await readMember("bob"))?.removedAt).toEqual(expect.any(String));
    expect((await readFamily())?.adminCount).toBe(1);
  });

  it("allows non-Admin self-removal but denies removing another Family Member", async () => {
    await seedFamily();
    const bobDb = testEnv.authenticatedContext("bob").firestore();

    await expect(
      removeFamilyMember(familyId, "charlie", makeUser("bob"), bobDb),
    ).rejects.toThrow(/only admins/i);
    await removeFamilyMember(familyId, "bob", makeUser("bob"), bobDb);
    expect((await readMember("bob"))?.removedAt).toEqual(expect.any(String));
    expect((await readFamily())?.adminCount).toBe(1);
  });
});

describe("managed child and Wish authorization", () => {
  it("limits child creation and Guardian assignment to authorized Family Members", async () => {
    await seedFamily([
      { id: "alice", admin: true },
      { id: "bob", guardianIds: [] },
      { id: "charlie" },
      { id: "kid", kind: "managedChild", guardianIds: ["alice"] },
    ]);
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();
    const outsiderDb = testEnv.authenticatedContext("outsider").firestore();
    const childPath = `families/${familyId}/members/child`;

    await assertSucceeds(
      setDoc(doc(aliceDb, childPath), {
        kind: "managedChild",
        displayName: "Taylor",
        guardianIds: ["alice"],
        admin: false,
        createdBy: "alice",
        createdAt: new Date().toISOString(),
        removedAt: null,
      }),
    );
    await assertSucceeds(
      updateChildGuardians(
        familyId,
        "child",
        ["alice", "bob"],
        makeUser("alice"),
        aliceDb,
      ),
    );
    await assertFails(
      updateChildGuardians(
        familyId,
        "child",
        ["alice", "bob", "kid"],
        makeUser("alice"),
        aliceDb,
      ),
    );
    await assertSucceeds(
      updateChildGuardians(familyId, "child", ["bob"], makeUser("bob"), bobDb),
    );
    await assertFails(
      updateDoc(doc(charlieDb, childPath), { guardianIds: ["charlie"] }),
    );
    await assertFails(
      setDoc(doc(outsiderDb, `families/${familyId}/members/outsider-child`), {
        kind: "managedChild",
        displayName: "Outsider Child",
        guardianIds: ["outsider"],
      }),
    );
    await assertFails(
      setDoc(doc(charlieDb, `families/${familyId}/members/non-admin-child`), {
        kind: "managedChild",
        displayName: "Unauthorized Child",
        guardianIds: ["charlie"],
        createdBy: "charlie",
      }),
    );
  });

  it("allows a recipient or Guardian to create Wishes and denies other members", async () => {
    await seedFamily([
      { id: "alice", admin: true },
      { id: "bob" },
      { id: "charlie" },
      { id: "child", kind: "managedChild", guardianIds: ["alice"] },
    ]);
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const wish = (id: string, creatorId: string, recipientId: string) =>
      setDoc(doc(bobDb, `wishes/${id}`), {
        recipientId,
        creatorId,
        familyId,
        title: id,
        status: "available",
        createdAt: new Date().toISOString(),
      });

    await assertSucceeds(wish("recipient-wish", "bob", "bob"));
    await assertSucceeds(
      setDoc(doc(aliceDb, "wishes/guardian-wish"), {
        recipientId: "child",
        creatorId: "alice",
        familyId,
        title: "Guardian Wish",
        status: "available",
        createdAt: new Date().toISOString(),
      }),
    );
    await assertFails(wish("unauthorized-wish", "bob", "child"));
  });

  it("does not treat a Managed Child as a Guardian", async () => {
    await seedFamily([
      { id: "alice", admin: true },
      { id: "kid", kind: "managedChild", guardianIds: ["kid"] },
      { id: "child", kind: "managedChild", guardianIds: ["kid"] },
    ]);
    const kidDb = testEnv.authenticatedContext("kid").firestore();

    await assertFails(
      setDoc(doc(kidDb, "wishes/kid-created-for-child"), {
        recipientId: "child",
        creatorId: "kid",
        familyId,
        title: "Unauthorized child Wish",
        status: "available",
      }),
    );
    await assertFails(
      updateChildGuardians(
        familyId,
        "child",
        ["alice"],
        makeUser("kid"),
        kidDb,
      ),
    );
  });
});

describe("Family authorization fixtures", () => {
  it("preserves Family-scoped access and Surprise Privacy for removed and outside members", async () => {
    await seedFamily([
      { id: "alice", admin: true },
      { id: "bob" },
      { id: "removed", removedAt: new Date().toISOString() },
    ]);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/other-family"), {
        name: "Other Family",
        createdBy: "outsider",
        adminCount: 1,
      });
      await setDoc(doc(db, "families/other-family/members/outsider"), {
        kind: "adult",
        userId: "outsider",
        admin: true,
        removedAt: null,
      });
      await setDoc(doc(db, "wishes/family-wish"), {
        familyId,
        creatorId: "alice",
        recipientId: "bob",
        title: "Wish",
        status: "available",
      });
      await setDoc(doc(db, "giftIdeas/alice-secret"), {
        familyId,
        creatorId: "bob",
        recipientId: "alice",
        title: "Surprise",
      });
      await setDoc(doc(db, "claims/wish_secret"), {
        familyId,
        claimantId: "bob",
        recipientId: "alice",
        targetType: "wish",
        targetId: "secret",
      });
    });
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const removedDb = testEnv.authenticatedContext("removed").firestore();
    const outsiderDb = testEnv.authenticatedContext("outsider").firestore();

    await assertSucceeds(getDoc(doc(bobDb, "wishes/family-wish")));
    await assertFails(getDoc(doc(removedDb, `families/${familyId}`)));
    await assertFails(getDoc(doc(outsiderDb, `families/${familyId}`)));
    await assertFails(getDoc(doc(removedDb, "wishes/family-wish")));
    await assertFails(getDoc(doc(outsiderDb, "wishes/family-wish")));
    await assertFails(getDoc(doc(aliceDb, "giftIdeas/alice-secret")));
    await assertFails(getDoc(doc(aliceDb, "claims/wish_secret")));
    await assertFails(getDoc(doc(removedDb, "giftIdeas/alice-secret")));
    await assertFails(getDoc(doc(removedDb, "claims/wish_secret")));
    await assertFails(getDoc(doc(outsiderDb, "giftIdeas/alice-secret")));
    await assertFails(getDoc(doc(outsiderDb, "claims/wish_secret")));
    await assertSucceeds(getDoc(doc(bobDb, "giftIdeas/alice-secret")));
    await assertSucceeds(getDoc(doc(bobDb, "claims/wish_secret")));
  });

  it("denies a removed former Guardian access to child data and Guardian assignments", async () => {
    await seedFamily([
      { id: "alice", admin: true },
      { id: "former-guardian", removedAt: new Date().toISOString() },
      { id: "child", kind: "managedChild", guardianIds: ["former-guardian"] },
    ]);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "giftIdeas/child-surprise"), {
        familyId,
        recipientId: "child",
        creatorId: "alice",
        title: "Surprise",
      });
    });
    const formerGuardianDb = testEnv
      .authenticatedContext("former-guardian")
      .firestore();

    await assertFails(
      getDoc(doc(formerGuardianDb, "giftIdeas/child-surprise")),
    );
    await assertFails(
      updateDoc(doc(formerGuardianDb, `families/${familyId}/members/child`), {
        guardianIds: ["alice"],
      }),
    );
  });
});
