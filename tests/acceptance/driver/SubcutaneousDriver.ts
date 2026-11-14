import React from "react";
import { render, within, type BoundFunctions } from "@testing-library/react";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import { doc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { App } from "../../../src/App";
import { FirebaseProvider } from "../../../src/context/FirebaseProvider";
import {
  AuthContext,
  type AuthContextValue,
} from "../../../src/context/authContext";
import type { UserProfile } from "../../../src/types";
import {
  type WishlistDriver,
  type MemberSessionDriver,
  type WishData,
  type GiftIdeaData,
  type WishView,
  type GiftIdeaView,
} from "../prototype/WishlistDriver";
import {
  createWish,
  getActiveWishesForRecipient,
  updateWish,
  deleteWish,
} from "../../../src/lib/wishes";
import {
  claimItem,
  unclaimItem,
  getClaimsForFamily,
} from "../../../src/lib/claims";
import {
  createGiftIdea,
  getGiftIdeasForRecipient,
} from "../../../src/lib/giftIdeas";
import { createSessionContainer } from "../harness/acceptanceHarness";

export class SubcutaneousSession {
  public readonly container: HTMLDivElement;
  public readonly queries: BoundFunctions<
    typeof import("@testing-library/react")
  >;
  public readonly db: Firestore;
  public readonly user: User;
  public readonly profile: UserProfile;
  private unmountFn: () => void;

  constructor(
    public readonly name: string,
    public readonly familyId: string,
    testEnv: RulesTestEnvironment,
  ) {
    const uid = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const email = `${uid}@example.com`;

    this.user = {
      uid,
      email,
      displayName: name,
    } as unknown as User;

    this.profile = {
      displayName: name,
      email,
      normalizedEmail: email,
      createdAt: new Date().toISOString(),
      lastSelectedFamilyId: familyId,
    };

    this.db = testEnv
      .authenticatedContext(uid, { email })
      .firestore() as unknown as Firestore;
    this.container = createSessionContainer(name);

    const authValue: AuthContextValue = {
      user: this.user,
      profile: this.profile,
      loading: false,
      signInWithGoogle: async () => {},
      signInWithEmail: async () => {},
      signUpWithEmail: async () => {},
      signOut: async () => {},
      updateProfile: async () => {},
      refreshProfile: async () => {},
    };

    const rendered = render(
      React.createElement(
        FirebaseProvider,
        { db: this.db },
        React.createElement(
          AuthContext.Provider,
          { value: authValue },
          React.createElement(App, null),
        ),
      ),
      { container: this.container },
    );

    this.unmountFn = rendered.unmount;
    this.queries = within(this.container);
  }

  public teardown(): void {
    try {
      this.unmountFn();
    } catch {
      // ignore unmount errors
    }
    this.container.remove();
  }
}

export class SubcutaneousDriver implements WishlistDriver {
  private familyIds = new Map<string, string>();
  private memberUids = new Map<string, string>();
  private sessions = new Map<string, SubcutaneousSession>();

  constructor(private readonly testEnv: RulesTestEnvironment) {}

  async init(): Promise<void> {}

  async reset(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.teardown();
    }
    this.sessions.clear();
    this.familyIds.clear();
    this.memberUids.clear();
  }

  async cleanup(): Promise<void> {
    await this.reset();
  }

  getFamilyId(familyName: string): string {
    const id = this.familyIds.get(familyName);
    if (!id) throw new Error(`Unknown family "${familyName}"`);
    return id;
  }

  getMemberUid(memberName: string): string {
    return memberName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  }

  async createFamily(
    familyName: string,
    adminMemberName: string,
  ): Promise<string> {
    const familyId = `fam-${familyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
    const adminUid = this.getMemberUid(adminMemberName);
    const now = new Date().toISOString();

    this.familyIds.set(familyName, familyId);
    this.memberUids.set(adminMemberName, adminUid);

    await this.testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, `families/${familyId}`), {
        name: familyName,
        createdBy: adminUid,
        createdAt: now,
        deletedAt: null,
        adminCount: 1,
      });
      await setDoc(doc(adminDb, `families/${familyId}/members/${adminUid}`), {
        id: adminUid,
        kind: "adult",
        displayName: adminMemberName,
        userId: adminUid,
        admin: true,
        createdAt: now,
        createdBy: adminUid,
        removedAt: null,
      });
      await setDoc(doc(adminDb, `users/${adminUid}`), {
        displayName: adminMemberName,
        email: `${adminUid}@example.com`,
        normalizedEmail: `${adminUid}@example.com`,
        createdAt: now,
        lastSelectedFamilyId: familyId,
      });
    });

    return familyId;
  }

  async addFamilyMember(
    familyName: string,
    memberName: string,
    kind: "adult" | "child" = "adult",
  ): Promise<void> {
    const familyId = this.getFamilyId(familyName);
    const memberUid = this.getMemberUid(memberName);
    const now = new Date().toISOString();

    this.memberUids.set(memberName, memberUid);

    await this.testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, `families/${familyId}/members/${memberUid}`), {
        id: memberUid,
        kind,
        displayName: memberName,
        userId: memberUid,
        admin: false,
        createdAt: now,
        createdBy: memberUid,
        removedAt: null,
      });
      await setDoc(doc(adminDb, `users/${memberUid}`), {
        displayName: memberName,
        email: `${memberUid}@example.com`,
        normalizedEmail: `${memberUid}@example.com`,
        createdAt: now,
        lastSelectedFamilyId: familyId,
      });
    });
  }

  async sessionFor(
    memberName: string,
    familyName: string,
  ): Promise<MemberSessionDriver> {
    const familyId = this.getFamilyId(familyName);
    const memberUid = this.getMemberUid(memberName);

    let session = this.sessions.get(memberName);
    if (!session) {
      session = new SubcutaneousSession(memberName, familyId, this.testEnv);
      this.sessions.set(memberName, session);
    }

    const currentSession = session;
    const userDb = currentSession.db;
    const currentUser = currentSession.user;

    return {
      memberName,

      addWish: async (wish: WishData): Promise<string> => {
        const created = await createWish(
          {
            recipientId: memberUid,
            familyId,
            title: wish.title,
            description: wish.description,
          },
          currentUser,
          userDb,
        );
        return created.id;
      },

      editWish: async (
        wishId: string,
        updates: Partial<WishData>,
      ): Promise<void> => {
        await updateWish(
          wishId,
          {
            title: updates.title,
            description: updates.description,
          },
          userDb,
        );
      },

      deleteWish: async (wishId: string): Promise<void> => {
        await deleteWish(wishId, userDb);
      },

      claimWish: async (wishId: string): Promise<void> => {
        // Resolve target recipient
        const wishes = await getActiveWishesForRecipient(
          memberUid,
          familyId,
          userDb,
        );
        const myWish = wishes.find((w) => w.id === wishId);
        if (myWish) {
          // Self claim attempt
          await claimItem(
            "wish",
            wishId,
            memberUid,
            currentUser,
            familyId,
            userDb,
          );
          return;
        }

        // Search across other members
        let targetRecipientUid = "";
        for (const uid of this.memberUids.values()) {
          if (uid !== memberUid) {
            const memberWishes = await getActiveWishesForRecipient(
              uid,
              familyId,
              userDb,
            );
            if (memberWishes.some((w) => w.id === wishId)) {
              targetRecipientUid = uid;
              break;
            }
          }
        }

        await claimItem(
          "wish",
          wishId,
          targetRecipientUid || memberUid,
          currentUser,
          familyId,
          userDb,
        );
      },

      unclaimWish: async (wishId: string): Promise<void> => {
        await unclaimItem(`wish_${wishId}`, currentUser, userDb);
      },

      addGiftIdeaFor: async (
        recipientName: string,
        idea: GiftIdeaData,
      ): Promise<string> => {
        const recipientUid = this.getMemberUid(recipientName);
        const created = await createGiftIdea(
          {
            recipientId: recipientUid,
            familyId,
            title: idea.title,
            description: idea.description,
          },
          currentUser,
          userDb,
        );
        return created.id;
      },

      claimGiftIdea: async (giftIdeaId: string): Promise<void> => {
        let targetRecipientUid = "";
        for (const uid of this.memberUids.values()) {
          const ideas = await getGiftIdeasForRecipient(
            uid,
            familyId,
            currentUser.uid,
            userDb,
          );
          if (ideas.some((i) => i.id === giftIdeaId)) {
            targetRecipientUid = uid;
            break;
          }
        }
        await claimItem(
          "giftIdea",
          giftIdeaId,
          targetRecipientUid,
          currentUser,
          familyId,
          userDb,
        );
      },

      getWishesFor: async (recipientName: string): Promise<WishView[]> => {
        const recipientUid = this.getMemberUid(recipientName);
        const wishes = await getActiveWishesForRecipient(
          recipientUid,
          familyId,
          userDb,
        );

        // Surprise privacy: If viewing self, claims are never exposed!
        const isRecipient = memberUid === recipientUid;
        let claimsMap: Record<string, { claimantId: string }> = {};

        if (!isRecipient) {
          claimsMap = await getClaimsForFamily(
            familyId,
            currentUser.uid,
            userDb,
          );
        }

        return wishes.map((w) => {
          const claim = claimsMap[`wish_${w.id}`];
          const claimantName = claim
            ? (Array.from(this.memberUids.entries()).find(
                ([, uid]) => uid === claim.claimantId,
              )?.[0] ?? claim.claimantId)
            : undefined;

          return {
            id: w.id,
            title: w.title,
            description: w.description,
            isClaimed: Boolean(claim),
            claimedByName: claimantName,
          };
        });
      },

      getGiftIdeasFor: async (
        recipientName: string,
      ): Promise<GiftIdeaView[]> => {
        const recipientUid = this.getMemberUid(recipientName);
        const isRecipient = memberUid === recipientUid;

        // If recipient, getGiftIdeasForRecipient returns [] under Surprise Privacy
        if (isRecipient) {
          return [];
        }

        const ideas = await getGiftIdeasForRecipient(
          recipientUid,
          familyId,
          currentUser.uid,
          userDb,
        );
        const claimsMap = await getClaimsForFamily(
          familyId,
          currentUser.uid,
          userDb,
        );

        return ideas.map((idea) => {
          const claim = claimsMap[`giftIdea_${idea.id}`];
          const claimantName = claim
            ? (Array.from(this.memberUids.entries()).find(
                ([, uid]) => uid === claim.claimantId,
              )?.[0] ?? claim.claimantId)
            : undefined;

          return {
            id: idea.id,
            title: idea.title,
            description: idea.description,
            isClaimed: Boolean(claim),
            claimedByName: claimantName,
          };
        });
      },
    };
  }
}
