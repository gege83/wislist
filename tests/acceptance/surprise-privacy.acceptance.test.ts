/**
 * Layer 1: Executable Specification (Dave Farley Modern Software Engineering)
 *
 * Feature: Surprise Privacy & Gift Coordination
 *
 * As an Adult Family Member
 * I want to share my wishes and secretly coordinate gifts for others in my Family
 * So that gift ideas and claims remain a complete surprise to the recipient
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { WishlistAppDsl } from "./prototype/dsl";
import { SubcutaneousDriver } from "./driver/SubcutaneousDriver";
import { createAcceptanceTestEnvironment } from "./harness/acceptanceHarness";

describe("Surprise Privacy & Gift Coordination", () => {
  let testEnv: RulesTestEnvironment;
  let driver: SubcutaneousDriver;
  let wishlist: WishlistAppDsl;

  beforeAll(async () => {
    testEnv = await createAcceptanceTestEnvironment("surprise-privacy");
  });

  afterAll(async () => {
    if (driver) {
      await driver.cleanup();
    }
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    driver = new SubcutaneousDriver(testEnv);
    wishlist = new WishlistAppDsl(driver);
  });

  it("1. Wish Claiming: hides claims from the recipient while showing them to other family members", async () => {
    // Given a Family "The Smiths" with adult members Alice, Bob, and Charlie
    const smiths = await wishlist.createFamily("The Smiths", "Alice");
    const alice = await smiths.member("Alice");
    const bob = await smiths.withMember("Bob", "adult");
    const charlie = await smiths.withMember("Charlie", "adult");

    // And Alice has added a wish "Warm Wool Socks"
    const wish = await alice.addsWish({
      title: "Warm Wool Socks",
      description: "Thick winter socks",
    });

    // When Bob claims Alice's wish
    await bob.claimsWish(wish);

    // Then Bob can see that Alice's wish is claimed by him
    await bob.expectsWish(wish).toBeClaimedBy("Bob");

    // And Charlie can see that Alice's wish is claimed by Bob
    await charlie.expectsWish(wish).toBeClaimedBy("Bob");

    // But Alice (the Recipient) cannot see that her wish has been claimed
    await alice.expectsWish(wish).toNotBeClaimed();
  });

  it("2. Wish Unclaiming: returns wish to unclaimed state for others while recipient perceives no change", async () => {
    // Given a Family with Alice, Bob, and Charlie where Bob has claimed Alice's wish
    const smiths = await wishlist.createFamily("The Smiths", "Alice");
    const alice = await smiths.member("Alice");
    const bob = await smiths.withMember("Bob", "adult");
    const charlie = await smiths.withMember("Charlie", "adult");

    const wish = await alice.addsWish({ title: "Ceramic Teapot" });
    await bob.claimsWish(wish);

    // When Bob unclaims Alice's wish
    await bob.unclaimsWish(wish);

    // Then Bob and Charlie observe the wish as no longer claimed
    await bob.expectsWish(wish).toNotBeClaimed();
    await charlie.expectsWish(wish).toNotBeClaimed();

    // And Alice still observes her wish as unclaimed
    await alice.expectsWish(wish).toNotBeClaimed();
  });

  it("3. Gift Idea Secrecy: ensures hidden gift ideas are visible to other members but completely invisible to recipient", async () => {
    // Given a Family with Alice, Bob, and Charlie
    const smiths = await wishlist.createFamily("The Smiths", "Alice");
    const alice = await smiths.member("Alice");
    const bob = await smiths.withMember("Bob", "adult");
    const charlie = await smiths.withMember("Charlie", "adult");

    // When Bob adds a hidden gift idea for Alice
    const surpriseBike = await bob.addsGiftIdeaFor(alice, {
      title: "Surprise Bicycle",
      description: "Vintage red cruiser",
    });

    // Then Bob can see the hidden gift idea for Alice
    await bob.expectsToSeeGiftIdea(surpriseBike);

    // And Charlie can see the hidden gift idea for Alice
    await charlie.expectsToSeeGiftIdea(surpriseBike);

    // But Alice (the Recipient) cannot see or query the secret gift idea
    await alice.expectsToNotSeeGiftIdea(surpriseBike);
  });

  it("4. Gift Idea Claiming: allows claiming secret gift ideas while recipient remains in the dark", async () => {
    // Given Bob added a hidden gift idea for Alice
    const smiths = await wishlist.createFamily("The Smiths", "Alice");
    const alice = await smiths.member("Alice");
    const bob = await smiths.withMember("Bob", "adult");
    const charlie = await smiths.withMember("Charlie", "adult");

    const surpriseBike = await bob.addsGiftIdeaFor(alice, {
      title: "Surprise Bicycle",
    });

    // When Charlie claims Bob's gift idea for Alice
    await charlie.claimsGiftIdea(surpriseBike);

    // Then Charlie and Bob see that Charlie claimed the secret gift idea
    const charlieView = await charlie.expectsToSeeGiftIdea(surpriseBike);
    expect(charlieView.isClaimed).toBe(true);
    expect(charlieView.claimedByName).toBe("Charlie");

    const bobView = await bob.expectsToSeeGiftIdea(surpriseBike);
    expect(bobView.isClaimed).toBe(true);
    expect(bobView.claimedByName).toBe("Charlie");

    // But Alice still has zero visibility into the secret idea or its claim
    await alice.expectsToNotSeeGiftIdea(surpriseBike);
  });

  it("5. Self-Claim Prohibition: prevents the recipient from claiming their own wish", async () => {
    // Given a Family with Alice
    const smiths = await wishlist.createFamily("The Smiths", "Alice");
    const alice = await smiths.member("Alice");

    const wish = await alice.addsWish({ title: "Cashmere Sweater" });

    // When Alice attempts to claim her own wish
    // Then the action is rejected by domain rules
    await expect(alice.claimsWish(wish)).rejects.toThrow(
      /cannot claim an item intended for yourself/i,
    );
  });

  it("6. Concurrent Claims Race Condition: allows exactly one claim to succeed when members claim simultaneously", async () => {
    // Given Alice has an unclaimed wish, and both Bob and Charlie attempt to claim it at the same moment
    const smiths = await wishlist.createFamily("The Smiths", "Alice");
    const alice = await smiths.member("Alice");
    const bob = await smiths.withMember("Bob", "adult");
    const charlie = await smiths.withMember("Charlie", "adult");

    const wish = await alice.addsWish({ title: "Handmade Quilt" });

    // When Bob and Charlie submit claim operations concurrently
    const results = await Promise.allSettled([
      bob.claimsWish(wish),
      charlie.claimsWish(wish),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const rejections = results.filter((r) => r.status === "rejected");

    // Then exactly one claim succeeds and the other is rejected with a conflict error
    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
    expect((rejections[0] as PromiseRejectedResult).reason.message).toMatch(
      /already been claimed/i,
    );

    // And Alice's Surprise Privacy is preserved throughout
    await alice.expectsWish(wish).toNotBeClaimed();
  });
});

