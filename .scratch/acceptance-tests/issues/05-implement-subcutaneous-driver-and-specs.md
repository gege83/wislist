# Implement Subcutaneous Driver and Executable Specifications

Type: task
Status: resolved
Blocked by: 03, 04

## Question

How do we wire the `SubcutaneousDriver` into the application (using the `FirebaseContext` DI seam from Ticket 02) and write the complete 6-scenario executable specification suite in `tests/acceptance/surprise-privacy.acceptance.test.ts` passing deterministically under the test harness?

## Answer

The subcutaneous acceptance test driver and canonical 6-scenario executable specification suite have been fully implemented, wired, and verified:

1. **Lightweight Dependency Injection Seam**:
   - Implemented `src/context/FirebaseContext.tsx` (`FirebaseProvider`, `useFirestore`) and wrapped `<App />` with `<FirebaseProvider>` in `src/main.tsx`.
   - Updated mutative domain helpers in `src/lib/wishes.ts`, `src/lib/claims.ts`, `src/lib/giftIdeas.ts`, and `src/lib/families.ts` to accept `firestoreInstance: Firestore = db`.
   - Wired `useFirestore()` into `src/App.tsx`, `WishModal.tsx`, `GiftIdeaModal.tsx`, `FamilySetupScreen.tsx`, and `familyWorkspace.ts`.

2. **Subcutaneous Multi-Session Driver** (`tests/acceptance/driver/SubcutaneousDriver.ts`):
   - Implements `WishlistDriver` from the Dave Farley 4-layer model.
   - For each family member, creates a dedicated, isolated DOM session container (`createSessionContainer(memberName)`) and injects their authenticated Firestore security context (`testEnv.authenticatedContext(uid).firestore()`).

3. **Executable Specification Suite** (`tests/acceptance/surprise-privacy.acceptance.test.ts`):
   - Implemented all 6 canonical scenarios using the domain DSL:
     1. *Wish Claiming*: Hides claims from recipient while displaying to other members.
     2. *Wish Unclaiming*: Restores unclaimed state for others while recipient perceives no change.
     3. *Gift Idea Secrecy*: Gift ideas remain completely invisible to the recipient.
     4. *Gift Idea Claiming*: Secret gift ideas can be claimed by other members without leaking to the recipient.
     5. *Self-Claim Prohibition*: Recipient is blocked by domain rules from claiming their own item.
     6. *Concurrent Claim Race Condition*: Simultaneous claims by two members are atomically resolved so exactly one succeeds and the other is rejected with a conflict error.
   - All 6 tests pass deterministically in ~1.3s against the live Firestore emulator.

