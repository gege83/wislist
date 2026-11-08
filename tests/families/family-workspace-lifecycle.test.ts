// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { Family, FamilyMember, UserProfile } from "../../src/types";

const mocks = vi.hoisted(() => ({
  getUserFamilies: vi.fn(),
  getFamilyMembers: vi.fn(),
  subscribeWishesForRecipient: vi.fn(),
  subscribeGiftIdeasForRecipient: vi.fn(),
  subscribeClaimsForRecipient: vi.fn(),
}));

vi.mock("../../src/lib/families", () => ({
  getUserFamilies: mocks.getUserFamilies,
  getFamilyMembers: mocks.getFamilyMembers,
}));
vi.mock("../../src/lib/wishes", () => ({
  subscribeWishesForRecipient: mocks.subscribeWishesForRecipient,
}));
vi.mock("../../src/lib/giftIdeas", () => ({
  subscribeGiftIdeasForRecipient: mocks.subscribeGiftIdeasForRecipient,
}));
vi.mock("../../src/lib/claims", () => ({
  subscribeClaimsForRecipient: mocks.subscribeClaimsForRecipient,
}));

import { useFamilyWorkspace } from "../../src/lib/familyWorkspace";

const family: Family = {
  id: "family-a",
  name: "Smiths",
  createdBy: "alice",
  createdAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};
const members: FamilyMember[] = [
  {
    id: "alice",
    kind: "adult",
    displayName: "Alice",
    userId: "alice",
    admin: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "alice",
    removedAt: null,
  },
  {
    id: "bob",
    kind: "adult",
    displayName: "Bob",
    userId: "bob",
    admin: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "alice",
    removedAt: null,
  },
];
const user = { uid: "alice" } as User;
const profile: UserProfile = {
  displayName: "Alice",
  email: "alice@example.com",
  normalizedEmail: "alice@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSelectedFamilyId: "family-a",
};

afterEach(() => vi.clearAllMocks());

describe("family workspace listener lifecycle", () => {
  it("surfaces subscription errors and stops every listener when removed", async () => {
    mocks.getUserFamilies.mockResolvedValue([family]);
    mocks.getFamilyMembers.mockResolvedValue(members);
    const stopWishes = vi.fn();
    const stopIdeas = vi.fn();
    const stopClaims = vi.fn();
    mocks.subscribeWishesForRecipient.mockReturnValue(stopWishes);
    mocks.subscribeGiftIdeasForRecipient.mockReturnValue(stopIdeas);
    mocks.subscribeClaimsForRecipient.mockReturnValue(stopClaims);

    const { result, unmount } = renderHook(() =>
      useFamilyWorkspace(user, profile),
    );
    await waitFor(() =>
      expect(mocks.subscribeWishesForRecipient).toHaveBeenCalledOnce(),
    );
    expect(mocks.subscribeGiftIdeasForRecipient).toHaveBeenCalledOnce();
    expect(mocks.subscribeClaimsForRecipient).toHaveBeenCalledOnce();

    const onError = mocks.subscribeWishesForRecipient.mock.calls[0][3] as (
      error: Error,
    ) => void;
    act(() => onError(new Error("Wish listener failed")));
    expect(result.current.dataError).toBe("Wish listener failed");

    unmount();
    expect(stopWishes).toHaveBeenCalledOnce();
    expect(stopIdeas).toHaveBeenCalledOnce();
    expect(stopClaims).toHaveBeenCalledOnce();
  });
});
