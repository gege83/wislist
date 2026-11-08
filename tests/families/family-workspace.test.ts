// @vitest-environment jsdom
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import { doc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import type { UserProfile } from "../../src/types";

const projectId = "wishlist-family-workspace-test";
let testEnv: RulesTestEnvironment;
let useFamilyWorkspace: (typeof import("../../src/lib/familyWorkspace"))["useFamilyWorkspace"];

const user = { uid: "alice" } as User;
const profile: UserProfile = {
  displayName: "Alice",
  email: "alice@example.com",
  normalizedEmail: "alice@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSelectedFamilyId: "family-a",
};

async function seedFamily(
  firestore: ReturnType<
    RulesTestEnvironment["authenticatedContext"]
  >["firestore"],
  familyId: string,
  memberIds: string[],
) {
  await setDoc(doc(firestore, `families/${familyId}`), {
    name: familyId,
    createdBy: "alice",
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  });
  for (const memberId of memberIds) {
    await setDoc(doc(firestore, `families/${familyId}/members/${memberId}`), {
      kind: "adult",
      userId: memberId,
      displayName: memberId,
      admin: memberId === "alice",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "alice",
      removedAt: null,
    });
  }
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", projectId);
  vi.resetModules();
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules:
        "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }",
    },
  });
  ({ useFamilyWorkspace } = await import("../../src/lib/familyWorkspace"));
});

afterAll(async () => {
  await testEnv?.cleanup();
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("family workspace", () => {
  it("loads a selected Family and keeps wishes, Gift Ideas, and Claims live", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await seedFamily(firestore, "family-a", ["alice", "bob"]);
      await setDoc(doc(firestore, "wishes/wish-1"), {
        recipientId: "bob",
        creatorId: "bob",
        familyId: "family-a",
        title: "Board game",
        status: "available",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await setDoc(doc(firestore, "giftIdeas/idea-1"), {
        recipientId: "bob",
        creatorId: "alice",
        familyId: "family-a",
        title: "Puzzle",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await setDoc(doc(firestore, "claims/wish_wish-1"), {
        targetType: "wish",
        targetId: "wish-1",
        recipientId: "bob",
        claimantId: "alice",
        familyId: "family-a",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await setDoc(doc(firestore, "giftIdeas/alice-secret"), {
        recipientId: "alice",
        creatorId: "bob",
        familyId: "family-a",
        title: "Alice's surprise",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await setDoc(doc(firestore, "claims/wish_alice-secret"), {
        targetType: "wish",
        targetId: "alice-secret",
        recipientId: "alice",
        claimantId: "bob",
        familyId: "family-a",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });

    const { result, unmount } = renderHook(() =>
      useFamilyWorkspace(user, profile),
    );
    await waitFor(() => expect(result.current.family?.id).toBe("family-a"));
    await waitFor(() => expect(result.current.wishes).toHaveLength(1));
    await waitFor(() => expect(result.current.giftIdeas).toHaveLength(1));
    await waitFor(() =>
      expect(Object.keys(result.current.claims)).toHaveLength(1),
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "wishes/wish-2"), {
        recipientId: "bob",
        creatorId: "bob",
        familyId: "family-a",
        title: "New wish",
        status: "available",
        createdAt: "2026-01-02T00:00:00.000Z",
      });
      await setDoc(doc(firestore, "giftIdeas/idea-2"), {
        recipientId: "bob",
        creatorId: "alice",
        familyId: "family-a",
        title: "Live gift idea",
        createdAt: "2026-01-02T00:00:00.000Z",
      });
      await setDoc(doc(firestore, "claims/giftIdea_idea-2"), {
        targetType: "giftIdea",
        targetId: "idea-2",
        recipientId: "bob",
        claimantId: "alice",
        familyId: "family-a",
        createdAt: "2026-01-02T00:00:00.000Z",
      });
    });
    await waitFor(() => expect(result.current.wishes).toHaveLength(2));
    await waitFor(() => expect(result.current.giftIdeas).toHaveLength(2));
    await waitFor(() =>
      expect(Object.keys(result.current.claims)).toHaveLength(2),
    );

    await act(async () => {
      result.current.selectMember(
        result.current.members.find((member) => member.id === "alice")!,
      );
    });
    await waitFor(() =>
      expect(result.current.selectedMember?.id).toBe("alice"),
    );
    await waitFor(() => expect(result.current.wishes).toHaveLength(0));
    expect(result.current.giftIdeas).toEqual([]);
    expect(result.current.claims).toEqual({});

    await act(async () => {
      result.current.selectMember(
        result.current.members.find((member) => member.id === "bob")!,
      );
    });
    await waitFor(() => expect(result.current.selectedMember?.id).toBe("bob"));
    await waitFor(() => expect(result.current.giftIdeas).toHaveLength(2));
    await waitFor(() =>
      expect(Object.keys(result.current.claims)).toHaveLength(2),
    );

    unmount();
  });

  it("clears old Family data when selection changes and ignores later updates from it", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await seedFamily(firestore, "family-a", ["alice", "bob"]);
      await seedFamily(firestore, "family-b", ["alice", "charlie"]);
      await setDoc(doc(firestore, "wishes/a-wish"), {
        recipientId: "bob",
        creatorId: "bob",
        familyId: "family-a",
        title: "Old Family wish",
        status: "available",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await setDoc(doc(firestore, "wishes/b-wish"), {
        recipientId: "charlie",
        creatorId: "charlie",
        familyId: "family-b",
        title: "New Family wish",
        status: "available",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });

    const { result, unmount } = renderHook(() =>
      useFamilyWorkspace(user, profile),
    );
    await waitFor(() =>
      expect(result.current.wishes[0]?.title).toBe("Old Family wish"),
    );

    await act(async () => result.current.selectFamily("family-b"));
    await waitFor(() => expect(result.current.family?.id).toBe("family-b"));
    await waitFor(() =>
      expect(result.current.wishes[0]?.title).toBe("New Family wish"),
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "wishes/a-later-wish"), {
        recipientId: "bob",
        creatorId: "bob",
        familyId: "family-a",
        title: "Stale Family update",
        status: "available",
        createdAt: "2026-01-02T00:00:00.000Z",
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.wishes.map((wish) => wish.title)).toEqual([
      "New Family wish",
    ]);
    unmount();
  });
});
