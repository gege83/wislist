# Real-Time Sync For Wishes, Gift Ideas, And Claims

Status: resolved
Type: task
Blocked by: 07, 08, 10

Implement live snapshot subscriptions so additions, edits, deletions, claims, and unclaims appear immediately across all family members' screens.

## Acceptance Criteria

- When a family member creates, edits, or deletes a wish, the change immediately reflects on the screens of all family members viewing that recipient, as well as in "My Wishes" for the creator.
- When a family member creates or deletes a gift idea, it immediately appears on or disappears from the screens of other non-recipient family members viewing that recipient, preserving surprise privacy so the recipient never receives it.
- When a family member claims or unclaims a wish or gift idea, the claim status updates immediately across all screens viewing that member and updates claim counts across the family.
- Race conditions when two users attempt to claim the same item at once are safely rejected by Firestore transactions, updating the button to the winner and showing an inline friendly notice to the second user.
- A visual offline banner/badge indicates when the device has lost connection, notifying users that real-time sync is paused until reconnected.
- Firestore snapshot listeners cleanly unsubscribe on component unmount or when changing active family/recipient to prevent memory leaks and redundant listeners.

## Comments

- Added `subscribeWishesForRecipient` in `src/lib/wishes.ts`.
- Added `subscribeGiftIdeasForRecipient` in `src/lib/giftIdeas.ts` with strict recipient filtering to guarantee surprise privacy.
- Added `subscribeClaimsForRecipient` and `subscribeMyClaims` in `src/lib/claims.ts`.
- Wired up real-time Firestore listeners in `src/App.tsx` and `src/components/MyClaimsScreen.tsx` with clean teardown on recipient/family switch or unmount.
- Added conflict detection in `handleClaim` with inline notice ("Someone else just claimed this item!") for simultaneous claim attempts.
- Added network connectivity detection with an offline banner in `src/App.tsx` and styled in `src/styles.css`.
- Added automated integration tests in `tests/realtime/realtime-sync.test.ts` testing live additions, edits, soft-deletions, claims, unclaims, and surprise privacy guarantees.
