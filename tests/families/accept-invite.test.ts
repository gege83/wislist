import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { User } from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { acceptInvite } from "../../src/lib/families";
import { normalizeEmail } from "../../src/lib/auth";
import { UserProfile } from "../../src/types";

let testEnv: RulesTestEnvironment;

const recipientId = "bob_uid";
const recipientEmail = "BOB@EXAMPLE.COM";
const inviteId = "invite_for_bob";
const invalidInviteCases: Array<{
  state: string;
  inviteOverrides: Record<string, unknown>;
  message: string;
}> = [
  {
    state: "expired",
    inviteOverrides: {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      expiresAtTimestamp: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    },
    message: "expired",
  },
  {
    state: "revoked",
    inviteOverrides: { revokedAt: new Date().toISOString() },
    message: "revoked",
  },
  {
    state: "rejected",
    inviteOverrides: { rejectedAt: new Date().toISOString() },
    message: "already been rejected",
  },
  {
    state: "accepted",
    inviteOverrides: { acceptedAt: new Date().toISOString() },
    message: "already been accepted",
  },
];

function makeUser(): User {
  return {
    uid: recipientId,
    email: recipientEmail,
    displayName: "Bob Example",
  } as User;
}

function makeProfile(): UserProfile {
  return {
    displayName: "Bob Example",
    email: recipientEmail,
    normalizedEmail: normalizeEmail(recipientEmail),
    createdAt: new Date().toISOString(),
    lastSelectedFamilyId: null,
  };
}

async function seedFamilyAndInvite(
  options: {
    inviteOverrides?: Record<string, unknown>;
    includeProfile?: boolean;
    member?: Record<string, unknown>;
  } = {},
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, "families/fam1"), {
      name: "Smiths",
      createdBy: "alice_uid",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    });
    await setDoc(doc(firestore, "families/fam1/members/alice_uid"), {
      kind: "adult",
      userId: "alice_uid",
      displayName: "Alice Example",
      admin: true,
      removedAt: null,
      createdAt: new Date().toISOString(),
      createdBy: "alice_uid",
    });
    if (options.member) {
      await setDoc(
        doc(firestore, `families/fam1/members/${recipientId}`),
        options.member,
      );
    }
    await setDoc(doc(firestore, "invites", inviteId), {
      familyId: "fam1",
      email: "Bob@Example.com",
      normalizedEmail: "bob@example.com",
      createdBy: "alice_uid",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expiresAtTimestamp: Timestamp.fromDate(new Date(Date.now() + 60_000)),
      acceptedAt: null,
      acceptedBy: null,
      revokedAt: null,
      rejectedAt: null,
      rejectedBy: null,
      ...options.inviteOverrides,
    });
    if (options.includeProfile !== false) {
      await setDoc(doc(firestore, "users", recipientId), makeProfile());
    }
  });
}

async function readAdminDocument(path: string) {
  let result: Record<string, unknown> | null = null;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(context.firestore(), path));
    result = snapshot.exists() ? snapshot.data() : null;
  });
  return result;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: "christmas-wishlist-accept-invite-test",
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
  await testEnv.clearFirestore();
});

describe("acceptInvite", () => {
  it("accepts an active Invite and atomically updates membership and profile", async () => {
    await seedFamilyAndInvite();
    const user = makeUser();
    const firestore = testEnv
      .authenticatedContext(recipientId, { email: recipientEmail })
      .firestore();

    await expect(
      acceptInvite(inviteId, user, makeProfile(), firestore),
    ).resolves.toBe("fam1");

    const invite = await readAdminDocument(`invites/${inviteId}`);
    const member = await readAdminDocument(
      `families/fam1/members/${recipientId}`,
    );
    const profile = await readAdminDocument(`users/${recipientId}`);

    expect(invite?.acceptedBy).toBe(recipientId);
    expect(invite?.acceptedAt).toEqual(expect.any(String));
    expect(member).toMatchObject({
      kind: "adult",
      displayName: "Bob Example",
      userId: recipientId,
      admin: false,
      removedAt: null,
    });
    expect(profile?.lastSelectedFamilyId).toBe("fam1");
  });

  it("rejects a missing Invite without creating membership", async () => {
    const firestore = testEnv
      .authenticatedContext(recipientId, { email: recipientEmail })
      .firestore();

    await expect(
      acceptInvite(inviteId, makeUser(), makeProfile(), firestore),
    ).rejects.toThrow("Invite not found");

    const member = await readAdminDocument(
      `families/fam1/members/${recipientId}`,
    );
    expect(member).toBeNull();
  });

  it("rejects an email mismatch without changing the Invite", async () => {
    await seedFamilyAndInvite();
    const firestore = testEnv
      .authenticatedContext(recipientId, { email: recipientEmail })
      .firestore();

    await expect(
      acceptInvite(
        inviteId,
        { ...makeUser(), email: "other@example.com" } as User,
        makeProfile(),
        firestore,
      ),
    ).rejects.toThrow("different email address");

    const invite = await readAdminDocument(`invites/${inviteId}`);
    const member = await readAdminDocument(
      `families/fam1/members/${recipientId}`,
    );
    expect(invite?.acceptedAt).toBeNull();
    expect(member).toBeNull();
  });

  it.each(invalidInviteCases)(
    "rejects a $state Invite without creating membership",
    async ({ inviteOverrides, message }) => {
      await seedFamilyAndInvite({ inviteOverrides });
      const inviteBefore = await readAdminDocument(`invites/${inviteId}`);
      const firestore = testEnv
        .authenticatedContext(recipientId, { email: recipientEmail })
        .firestore();

      await expect(
        acceptInvite(inviteId, makeUser(), makeProfile(), firestore),
      ).rejects.toThrow(message);

      const inviteAfter = await readAdminDocument(`invites/${inviteId}`);
      const member = await readAdminDocument(
        `families/fam1/members/${recipientId}`,
      );
      expect(inviteAfter).toEqual(inviteBefore);
      expect(member).toBeNull();
    },
  );

  it("does not overwrite an existing active Family Member", async () => {
    await seedFamilyAndInvite({
      member: {
        kind: "adult",
        userId: recipientId,
        displayName: "Existing Admin",
        admin: true,
        removedAt: null,
        createdAt: new Date().toISOString(),
        createdBy: recipientId,
      },
    });
    const firestore = testEnv
      .authenticatedContext(recipientId, { email: recipientEmail })
      .firestore();

    await expect(
      acceptInvite(inviteId, makeUser(), makeProfile(), firestore),
    ).rejects.toThrow("already a member");

    const invite = await readAdminDocument(`invites/${inviteId}`);
    const member = await readAdminDocument(
      `families/fam1/members/${recipientId}`,
    );
    expect(invite?.acceptedAt).toBeNull();
    expect(member?.admin).toBe(true);
    expect(member?.displayName).toBe("Existing Admin");
  });

  it("rolls back acceptance when the profile update cannot be committed", async () => {
    await seedFamilyAndInvite({ includeProfile: false });
    const firestore = testEnv
      .authenticatedContext(recipientId, { email: recipientEmail })
      .firestore();

    await expect(
      acceptInvite(inviteId, makeUser(), makeProfile(), firestore),
    ).rejects.toThrow();

    const invite = await readAdminDocument(`invites/${inviteId}`);
    const member = await readAdminDocument(
      `families/fam1/members/${recipientId}`,
    );
    const profile = await readAdminDocument(`users/${recipientId}`);
    expect(invite?.acceptedAt).toBeNull();
    expect(member).toBeNull();
    expect(profile).toBeNull();
  });

  it("allows only one concurrent acceptance of an Invite", async () => {
    await seedFamilyAndInvite();
    const firestore = testEnv
      .authenticatedContext(recipientId, { email: recipientEmail })
      .firestore();

    const results = await Promise.allSettled([
      acceptInvite(inviteId, makeUser(), makeProfile(), firestore),
      acceptInvite(inviteId, makeUser(), makeProfile(), firestore),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const member = await readAdminDocument(
      `families/fam1/members/${recipientId}`,
    );
    expect(member?.userId).toBe(recipientId);
  });
});
