/**
 * Layer 2: Domain DSL (Dave Farley 4-Layer Architecture)
 *
 * Expresses test interactions strictly in domain concepts from GLOSSARY.md:
 * Family, Family Member, Wish, Gift Idea, Claim, Surprise Privacy, Recipient.
 * Free from any UI, DOM, or database implementation details.
 */

import { expect } from "vitest";
import type {
  WishlistDriver,
  MemberSessionDriver,
  WishData,
  GiftIdeaData,
  WishView,
  GiftIdeaView,
} from "./WishlistDriver";

export class WishReference {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly recipientName: string,
  ) {}
}

export class GiftIdeaReference {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly recipientName: string,
  ) {}
}

export class WishAssertionDsl {
  constructor(
    private readonly member: MemberDsl,
    private readonly wish: WishReference,
  ) {}

  private async fetchView(): Promise<WishView> {
    const wishes = await this.member.session.getWishesFor(this.wish.recipientName);
    const found = wishes.find((w) => w.id === this.wish.id || w.title === this.wish.title);
    if (!found) {
      throw new Error(
        `Family member "${this.member.name}" cannot find wish "${this.wish.title}" for recipient "${this.wish.recipientName}"`,
      );
    }
    return found;
  }

  async toBeClaimed(): Promise<void> {
    const view = await this.fetchView();
    expect(view.isClaimed, `Expected wish "${this.wish.title}" to be claimed, but it was not.`).toBe(true);
  }

  async toBeClaimedBy(expectedMemberName: string): Promise<void> {
    const view = await this.fetchView();
    expect(view.isClaimed, `Expected wish "${this.wish.title}" to be claimed`).toBe(true);
    expect(
      view.claimedByName,
      `Expected wish "${this.wish.title}" to be claimed by "${expectedMemberName}", but was "${view.claimedByName}"`,
    ).toBe(expectedMemberName);
  }

  async toNotBeClaimed(): Promise<void> {
    const view = await this.fetchView();
    expect(
      view.isClaimed,
      `Expected wish "${this.wish.title}" to NOT appear claimed (Surprise Privacy violation), but it did.`,
    ).toBe(false);
  }
}

export class MemberDsl {
  constructor(
    public readonly name: string,
    public readonly familyName: string,
    public readonly session: MemberSessionDriver,
  ) {}

  async addsWish(data: { title: string; description?: string; url?: string }): Promise<WishReference> {
    const id = await this.session.addWish(data);
    return new WishReference(id, data.title, this.name);
  }

  async claimsWish(wish: WishReference): Promise<void> {
    await this.session.claimWish(wish.id);
  }

  async unclaimsWish(wish: WishReference): Promise<void> {
    await this.session.unclaimWish(wish.id);
  }

  async addsGiftIdeaFor(
    recipient: MemberDsl | string,
    idea: { title: string; description?: string; url?: string },
  ): Promise<GiftIdeaReference> {
    const recipientName = typeof recipient === "string" ? recipient : recipient.name;
    const id = await this.session.addGiftIdeaFor(recipientName, idea);
    return new GiftIdeaReference(id, idea.title, recipientName);
  }

  async claimsGiftIdea(giftIdea: GiftIdeaReference): Promise<void> {
    await this.session.claimGiftIdea(giftIdea.id);
  }

  expectsWish(wish: WishReference): WishAssertionDsl {
    return new WishAssertionDsl(this, wish);
  }

  async expectsToSeeGiftIdea(giftIdea: GiftIdeaReference): Promise<GiftIdeaView> {
    const ideas = await this.session.getGiftIdeasFor(giftIdea.recipientName);
    const found = ideas.find((i) => i.id === giftIdea.id || i.title === giftIdea.title);
    expect(
      found,
      `Expected member "${this.name}" to see gift idea "${giftIdea.title}", but it was not found.`,
    ).toBeDefined();
    return found!;
  }

  async expectsToNotSeeGiftIdea(giftIdea: GiftIdeaReference): Promise<void> {
    const ideas = await this.session.getGiftIdeasFor(giftIdea.recipientName);
    const found = ideas.find((i) => i.id === giftIdea.id || i.title === giftIdea.title);
    expect(
      found,
      `Surprise Privacy violation: recipient "${this.name}" can see hidden gift idea "${giftIdea.title}"!`,
    ).toBeUndefined();
  }
}

export class FamilyDsl {
  constructor(
    public readonly name: string,
    private readonly driver: WishlistDriver,
  ) {}

  async withMember(name: string, kind: "adult" | "child" = "adult"): Promise<MemberDsl> {
    await this.driver.addFamilyMember(this.name, name, kind);
    return this.member(name);
  }

  async member(name: string): Promise<MemberDsl> {
    const session = await this.driver.sessionFor(name, this.name);
    return new MemberDsl(name, this.name, session);
  }
}

export class WishlistAppDsl {
  constructor(private readonly driver: WishlistDriver) {}

  async createFamily(name: string, adminMemberName: string = "Admin"): Promise<FamilyDsl> {
    await this.driver.createFamily(name, adminMemberName);
    return new FamilyDsl(name, this.driver);
  }
}

