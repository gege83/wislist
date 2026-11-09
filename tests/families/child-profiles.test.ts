import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { FamilyMember } from "../../src/types";
import { updateChildGuardians } from "../../src/lib/families";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: "christmas-wishlist-child-test",
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

describe("Managed Child Profiles", () => {
  it("an Admin can create a managed child profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smith Family",
        createdBy: "alice",
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "families/fam1/members/alice"), {
        kind: "adult",
        userId: "alice",
        admin: true,
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    const childRef = doc(aliceDb, "families/fam1/members/child_timmy");
    await setDoc(childRef, {
      kind: "managedChild",
      displayName: "Timmy",
      guardianIds: ["alice"],
      createdAt: new Date().toISOString(),
      createdBy: "alice",
      removedAt: null,
    });

    const snap = await getDoc(childRef);
    expect(snap.exists()).toBe(true);
    const child = snap.data() as FamilyMember;
    expect(child.kind).toBe("managedChild");
    expect(child.displayName).toBe("Timmy");
    expect(child.guardianIds).toEqual(["alice"]);
  });

  it("admins and existing guardians can update child guardians", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/fam1"), {
        name: "Smith Family",
        createdBy: "alice",
      });
      await setDoc(doc(db, "families/fam1/members/alice"), {
        kind: "adult",
        userId: "alice",
        admin: false,
      });
      await setDoc(doc(db, "families/fam1/members/bob"), {
        kind: "adult",
        userId: "bob",
        admin: true, // Bob is admin
      });
      await setDoc(doc(db, "families/fam1/members/charlie"), {
        kind: "adult",
        userId: "charlie",
        admin: false,
      });
      await setDoc(doc(db, "families/fam1/members/child_timmy"), {
        kind: "managedChild",
        displayName: "Timmy",
        guardianIds: ["alice"],
        createdAt: new Date().toISOString(),
        createdBy: "alice",
        removedAt: null,
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const charlieDb = testEnv.authenticatedContext("charlie").firestore();

    const childRefAlice = doc(aliceDb, "families/fam1/members/child_timmy");
    const childRefBob = doc(bobDb, "families/fam1/members/child_timmy");
    const childRefCharlie = doc(charlieDb, "families/fam1/members/child_timmy");

    // Alice (guardian) can add Bob as guardian
    await updateChildGuardians(
      "fam1",
      "child_timmy",
      ["alice", "bob"],
      { uid: "alice" } as User,
      aliceDb,
    );

    let snap = await getDoc(childRefAlice);
    expect((snap.data() as FamilyMember).guardianIds).toEqual(["alice", "bob"]);

    // Bob (admin) can update guardians
    await updateChildGuardians(
      "fam1",
      "child_timmy",
      ["bob"],
      { uid: "bob" } as User,
      bobDb,
    );

    snap = await getDoc(childRefBob);
    expect((snap.data() as FamilyMember).guardianIds).toEqual(["bob"]);

    // Charlie (neither admin nor guardian) cannot update guardians
    await expect(
      updateDoc(childRefCharlie, {
        guardianIds: ["charlie"],
      }),
    ).rejects.toThrow();
  });

  it("non-family member cannot create or update managed child profiles", async () => {
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
    });

    const outsiderDb = testEnv.authenticatedContext("stranger").firestore();
    const childRef = doc(outsiderDb, "families/fam1/members/child_stranger");

    await expect(
      setDoc(childRef, {
        kind: "managedChild",
        displayName: "Kid",
        guardianIds: ["stranger"],
        createdAt: new Date().toISOString(),
        createdBy: "stranger",
      }),
    ).rejects.toThrow();
  });
});
