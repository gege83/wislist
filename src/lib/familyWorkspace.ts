import { useCallback, useEffect, useRef, useState } from "react";
import { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { db } from "./firebase";
import {
  Claim,
  Family,
  FamilyMember,
  GiftIdea,
  UserProfile,
  Wish,
} from "../types";
import { getFamilyMembers, getUserFamilies } from "./families";
import { subscribeWishesForRecipient } from "./wishes";
import { subscribeGiftIdeasForRecipient } from "./giftIdeas";
import { subscribeClaimsForRecipient } from "./claims";

export interface FamilyWorkspaceSnapshot {
  families: Family[];
  family: Family | null;
  members: FamilyMember[];
  selectedMember: FamilyMember | null;
  wishes: Wish[];
  giftIdeas: GiftIdea[];
  claims: Record<string, Claim>;
  loading: boolean;
  error: string | null;
  dataLoading: boolean;
  dataError: string | null;
}

export interface FamilyWorkspace extends FamilyWorkspaceSnapshot {
  selectFamily: (familyId: string) => Promise<void>;
  selectMember: (member: FamilyMember) => void;
  refresh: (familyId?: string) => Promise<void>;
  refreshMembers: () => Promise<void>;
  addMember: (member: FamilyMember) => void;
  updateClaims: (
    update: (claims: Record<string, Claim>) => Record<string, Claim>,
  ) => void;
}

const initial: FamilyWorkspaceSnapshot = {
  families: [],
  family: null,
  members: [],
  selectedMember: null,
  wishes: [],
  giftIdeas: [],
  claims: {},
  loading: true,
  error: null,
  dataLoading: false,
  dataError: null,
};

export function useFamilyWorkspace(
  user: User | null,
  profile: UserProfile | null,
  firestoreInstance: Firestore = db,
): FamilyWorkspace {
  const [state, setState] = useState(initial);
  const loadVersion = useRef(0);
  const selectedMemberRef = useRef<FamilyMember | null>(null);
  selectedMemberRef.current = state.selectedMember;

  const refresh = useCallback(
    async (targetFamilyId?: string) => {
      if (!user) {
        loadVersion.current++;
        setState({ ...initial, loading: false });
        return;
      }
      const version = ++loadVersion.current;
      setState((current) => ({
        ...current,
        family: null,
        members: [],
        selectedMember: null,
        loading: true,
        error: null,
        wishes: [],
        giftIdeas: [],
        claims: {},
        dataLoading: false,
        dataError: null,
      }));
      try {
        const families = await getUserFamilies(
          user.uid,
          targetFamilyId || profile?.lastSelectedFamilyId,
          firestoreInstance,
        );
        if (version !== loadVersion.current) return;
        const selectedFamily =
          families.find((f) => f.id === targetFamilyId) ??
          families.find((f) => f.id === profile?.lastSelectedFamilyId) ??
          families[0] ??
          null;
        if (!selectedFamily) {
          setState({ ...initial, families, loading: false });
          return;
        }
        const members = await getFamilyMembers(selectedFamily.id, firestoreInstance);
        if (version !== loadVersion.current) return;
        const previous = selectedMemberRef.current;
        const others = members.filter((member) => member.userId !== user.uid);
        const selectedMember =
          previous && members.some((member) => member.id === previous.id)
            ? members.find((member) => member.id === previous.id)!
            : (others[0] ?? members[0] ?? null);
        setState((current) => ({
          ...current,
          families,
          family: selectedFamily,
          members,
          selectedMember,
          wishes: [],
          giftIdeas: [],
          claims: {},
          loading: false,
          error: null,
          dataLoading: Boolean(selectedMember),
          dataError: null,
        }));
      } catch (error) {
        if (version !== loadVersion.current) return;
        setState((current) => ({
          ...current,
          loading: false,
          error:
            error instanceof Error ? error.message : "Failed to load family.",
          wishes: [],
          giftIdeas: [],
          claims: {},
          dataLoading: false,
        }));
      }
    },
    [user, profile],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const familyId = state.family?.id;
  const memberId = state.selectedMember?.id;
  useEffect(() => {
    if (!familyId || !memberId || !user) {
      setState((current) => ({
        ...current,
        wishes: [],
        giftIdeas: [],
        claims: {},
        dataLoading: false,
        dataError: null,
      }));
      return;
    }
    let active = true;
    setState((current) => ({
      ...current,
      wishes: [],
      giftIdeas: [],
      claims: {},
      dataLoading: true,
      dataError: null,
    }));
    const handleError = (error: Error) => {
      if (!active) return;
      setState((current) => ({
        ...current,
        dataLoading: false,
        dataError: error.message,
      }));
    };
    const stopWishes = subscribeWishesForRecipient(
      memberId,
      familyId,
      (wishes) => {
        if (active)
          setState((current) => ({ ...current, wishes, dataLoading: false }));
      },
      handleError,
      firestoreInstance,
    );
    const stopIdeas = subscribeGiftIdeasForRecipient(
      memberId,
      familyId,
      user.uid,
      (giftIdeas) => {
        if (active) setState((current) => ({ ...current, giftIdeas }));
      },
      handleError,
      firestoreInstance,
    );
    const stopClaims = subscribeClaimsForRecipient(
      familyId,
      memberId,
      user.uid,
      (claims) => {
        if (active) setState((current) => ({ ...current, claims }));
      },
      handleError,
      firestoreInstance,
    );
    return () => {
      active = false;
      stopWishes();
      stopIdeas();
      stopClaims();
    };
  }, [familyId, memberId, user, firestoreInstance]);

  const selectFamily = useCallback(
    (familyId: string) => refresh(familyId),
    [refresh],
  );
  const selectMember = useCallback((member: FamilyMember) => {
    setState((current) =>
      current.selectedMember?.id === member.id
        ? current
        : {
            ...current,
            selectedMember: member,
            wishes: [],
            giftIdeas: [],
            claims: {},
            dataLoading: true,
            dataError: null,
          },
    );
  }, []);
  const refreshMembers = useCallback(async () => {
    const familyId = state.family?.id;
    if (!familyId) return;
    const members = await getFamilyMembers(familyId, firestoreInstance);
    setState((current) => {
      const selectedMember = current.selectedMember
        ? members.find((member) => member.id === current.selectedMember?.id)
        : undefined;
      return {
        ...current,
        members,
        selectedMember:
          selectedMember ??
          members.find((member) => member.userId !== user?.uid) ??
          members[0] ??
          null,
      };
    });
  }, [state.family?.id, user?.uid]);
  const addMember = useCallback(
    (member: FamilyMember) =>
      setState((current) => ({
        ...current,
        members: [...current.members, member],
      })),
    [],
  );
  const updateClaims = useCallback(
    (update: (claims: Record<string, Claim>) => Record<string, Claim>) =>
      setState((current) => ({ ...current, claims: update(current.claims) })),
    [],
  );

  return {
    ...state,
    selectFamily,
    selectMember,
    refresh,
    refreshMembers,
    addMember,
    updateClaims,
  };
}
