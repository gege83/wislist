/**
 * Layer 3 Prototype Stub: InMemorySimulatedDriver
 *
 * Fast in-memory implementation of WishlistDriver used to validate the ergonomics
 * and type-soundness of the Layer 1 & 2 Domain DSL without needing emulators or DOM.
 */

import type {
  WishlistDriver,
  MemberSessionDriver,
  WishData,
  GiftIdeaData,
  WishView,
  GiftIdeaView,
} from "./WishlistDriver";

interface StoredWish {
  id: string;
  recipientName: string;
  familyName: string;
  title: string;
  description?: string;
  url?: string;
  claimedBy?: string;
}

interface StoredGiftIdea {
  id: string;
  recipientName: string;
  createdByName: string;
  familyName: string;
  title: string;
  description?: string;
  url?: string;
  claimedBy?: string;
}

export class InMemorySimulatedDriver implements WishlistDriver {
  private families = new Set<string>();
  private familyMembers = new Map<string, Map<string, "adult" | "child">>();
  private wishes: StoredWish[] = [];
  private giftIdeas: StoredGiftIdea[] = [];
  private idCounter = 1;

  async init(): Promise<void> {}
  async reset(): Promise<void> {
    this.families.clear();
    this.familyMembers.clear();
    this.wishes = [];
    this.giftIdeas = [];
  }
  async cleanup(): Promise<void> {}

  async createFamily(familyName: string, adminMemberName: string): Promise<string> {
    this.families.add(familyName);
    const members = new Map<string, "adult" | "child">();
    members.set(adminMemberName, "adult");
    this.familyMembers.set(familyName, members);
    return familyName;
  }

  async addFamilyMember(familyName: string, memberName: string, kind: "adult" | "child" = "adult"): Promise<void> {
    const members = this.familyMembers.get(familyName) ?? new Map<string, "adult" | "child">();
    members.set(memberName, kind);
    this.familyMembers.set(familyName, members);
  }

  async sessionFor(memberName: string, familyName: string): Promise<MemberSessionDriver> {
    return {
      memberName,

      addWish: async (wish: WishData): Promise<string> => {
        const id = `wish-${this.idCounter++}`;
        this.wishes.push({
          id,
          recipientName: memberName,
          familyName,
          title: wish.title,
          description: wish.description,
          url: wish.url,
        });
        return id;
      },

      editWish: async (wishId: string, updates: Partial<WishData>): Promise<void> => {
        const item = this.wishes.find((w) => w.id === wishId);
        if (item) Object.assign(item, updates);
      },

      deleteWish: async (wishId: string): Promise<void> => {
        this.wishes = this.wishes.filter((w) => w.id !== wishId);
      },

      claimWish: async (wishId: string): Promise<void> => {
        const item = this.wishes.find((w) => w.id === wishId);
        if (item) item.claimedBy = memberName;
      },

      unclaimWish: async (wishId: string): Promise<void> => {
        const item = this.wishes.find((w) => w.id === wishId);
        if (item && item.claimedBy === memberName) item.claimedBy = undefined;
      },

      addGiftIdeaFor: async (recipientName: string, idea: GiftIdeaData): Promise<string> => {
        const id = `gift-${this.idCounter++}`;
        this.giftIdeas.push({
          id,
          recipientName,
          createdByName: memberName,
          familyName,
          title: idea.title,
          description: idea.description,
          url: idea.url,
        });
        return id;
      },

      claimGiftIdea: async (giftIdeaId: string): Promise<void> => {
        const item = this.giftIdeas.find((g) => g.id === giftIdeaId);
        if (item) item.claimedBy = memberName;
      },

      getWishesFor: async (recipientName: string): Promise<WishView[]> => {
        // Enforce Surprise Privacy domain rule:
        // If the viewer IS the recipient, hide all claims!
        const isRecipient = memberName === recipientName;
        return this.wishes
          .filter((w) => w.familyName === familyName && w.recipientName === recipientName)
          .map((w) => ({
            id: w.id,
            title: w.title,
            description: w.description,
            url: w.url,
            isClaimed: isRecipient ? false : Boolean(w.claimedBy),
            claimedByName: isRecipient ? undefined : w.claimedBy,
          }));
      },

      getGiftIdeasFor: async (recipientName: string): Promise<GiftIdeaView[]> => {
        // Enforce Surprise Privacy domain rule:
        // If the viewer IS the recipient, hidden gift ideas are completely invisible!
        if (memberName === recipientName) {
          return [];
        }
        return this.giftIdeas
          .filter((g) => g.familyName === familyName && g.recipientName === recipientName)
          .map((g) => ({
            id: g.id,
            title: g.title,
            description: g.description,
            url: g.url,
            isClaimed: Boolean(g.claimedBy),
            claimedByName: g.claimedBy,
          }));
      },
    };
  }
}

