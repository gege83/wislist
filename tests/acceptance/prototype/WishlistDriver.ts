/**
 * Layer 3: Protocol / Driver Interface (Dave Farley 4-Layer Architecture)
 *
 * This interface isolates the domain DSL and acceptance tests from the execution
 * mechanism (whether subcutaneous in-memory React, or browser-based Playwright).
 */

export interface WishData {
  id?: string;
  title: string;
  description?: string;
  url?: string;
}

export interface GiftIdeaData {
  id?: string;
  title: string;
  description?: string;
  url?: string;
}

export interface WishView {
  id: string;
  title: string;
  description?: string;
  url?: string;
  isClaimed: boolean;
  claimedByName?: string;
}

export interface GiftIdeaView {
  id: string;
  title: string;
  description?: string;
  url?: string;
  isClaimed: boolean;
  claimedByName?: string;
}

export interface MemberSessionDriver {
  readonly memberName: string;

  // Wishes
  addWish(wish: WishData): Promise<string>;
  editWish(wishId: string, updates: Partial<WishData>): Promise<void>;
  deleteWish(wishId: string): Promise<void>;

  // Claims
  claimWish(wishId: string): Promise<void>;
  unclaimWish(wishId: string): Promise<void>;

  // Gift Ideas
  addGiftIdeaFor(recipientName: string, idea: GiftIdeaData): Promise<string>;
  claimGiftIdea(giftIdeaId: string): Promise<void>;

  // Observations (What this member perceives through their interface)
  getWishesFor(recipientName: string): Promise<WishView[]>;
  getGiftIdeasFor(recipientName: string): Promise<GiftIdeaView[]>;
}

export interface WishlistDriver {
  init(): Promise<void>;
  createFamily(familyName: string, adminMemberName: string): Promise<string>;
  addFamilyMember(familyName: string, memberName: string, kind?: "adult" | "child"): Promise<void>;
  sessionFor(memberName: string, familyName: string): Promise<MemberSessionDriver>;
  reset(): Promise<void>;
  cleanup(): Promise<void>;
}

