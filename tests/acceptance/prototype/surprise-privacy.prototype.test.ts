/**
 * Layer 1: Executable Specification (Dave Farley Modern Software Engineering)
 *
 * Feature: Surprise Privacy & Gift Coordination
 *
 * As a Family Member
 * I want to share my wishes and coordinate gifts for other family members
 * So that gift ideas and claims remain a complete surprise to the recipient
 */

import { describe, it, beforeEach } from "vitest";
import { WishlistAppDsl } from "./dsl";
import { InMemorySimulatedDriver } from "./InMemorySimulatedDriver";

describe("Surprise Privacy & Gift Coordination", () => {
  let wishlist: WishlistAppDsl;
  let driver: InMemorySimulatedDriver;

  beforeEach(async () => {
    driver = new InMemorySimulatedDriver();
    await driver.init();
    wishlist = new WishlistAppDsl(driver);
  });

  it("ensures claims and gift ideas are visible to other family members but hidden from the recipient", async () => {
    // Given a Family "The Smiths" with adult members Alice and Bob
    const smiths = await wishlist.createFamily("The Smiths", "Alice");
    const alice = await smiths.member("Alice");
    const bob = await smiths.withMember("Bob", "adult");

    // And Alice has added a wish "Handmade Wool Socks"
    const wish = await alice.addsWish({
      title: "Handmade Wool Socks",
      description: "Warm socks for winter",
    });

    // When Bob claims Alice's wish
    await bob.claimsWish(wish);

    // And Bob adds a hidden gift idea "Surprise Bicycle" for Alice
    const bicycleIdea = await bob.addsGiftIdeaFor(alice, {
      title: "Surprise Bicycle",
      description: "Vintage red cruiser",
    });

    // Then Bob can see that Alice's wish is claimed by him
    await bob.expectsWish(wish).toBeClaimedBy("Bob");

    // And Bob can see the hidden gift idea he created for Alice
    await bob.expectsToSeeGiftIdea(bicycleIdea);

    // But Alice (the Recipient) cannot see that her wish has been claimed (Surprise Privacy)
    await alice.expectsWish(wish).toNotBeClaimed();

    // And Alice (the Recipient) cannot see the hidden gift idea recommended for her
    await alice.expectsToNotSeeGiftIdea(bicycleIdea);
  });
});

