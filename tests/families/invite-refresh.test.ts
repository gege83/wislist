import { describe, expect, it, vi } from "vitest";
import { acceptInviteAndRefresh, refreshInviteLists } from "../../src/lib/inviteRefresh";

describe("invite list refresh", () => {
  it("reloads pending and sent invites when refreshing the invite lists", async () => {
    const loadPendingInvites = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const loadSentInvites = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await refreshInviteLists(loadPendingInvites, loadSentInvites);

    expect(loadPendingInvites).toHaveBeenCalledOnce();
    expect(loadSentInvites).toHaveBeenCalledOnce();
  });

  it("refreshes both invite lists after acceptance succeeds", async () => {
    const events: string[] = [];
    const accept = vi.fn(async () => {
      events.push("accepted");
      return "family-1";
    });
    const loadPendingInvites = vi.fn(async () => {
      events.push("pending-refreshed");
    });
    const loadSentInvites = vi.fn(async () => {
      events.push("sent-refreshed");
    });

    const joinedFamilyId = await acceptInviteAndRefresh(
      accept,
      () => refreshInviteLists(loadPendingInvites, loadSentInvites)
    );

    expect(joinedFamilyId).toBe("family-1");
    expect(accept).toHaveBeenCalledOnce();
    expect(loadPendingInvites).toHaveBeenCalledOnce();
    expect(loadSentInvites).toHaveBeenCalledOnce();
    expect(events[0]).toBe("accepted");
    expect(events.slice(1).sort()).toEqual(["pending-refreshed", "sent-refreshed"]);
  });

  it("does not refresh lists when acceptance fails", async () => {
    const loadPendingInvites = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const loadSentInvites = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      acceptInviteAndRefresh(
        async () => {
          throw new Error("accept failed");
        },
        () => refreshInviteLists(loadPendingInvites, loadSentInvites)
      )
    ).rejects.toThrow("accept failed");

    expect(loadPendingInvites).not.toHaveBeenCalled();
    expect(loadSentInvites).not.toHaveBeenCalled();
  });
});
