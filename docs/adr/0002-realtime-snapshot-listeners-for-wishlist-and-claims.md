# Real-Time Snapshot Listeners For Wishes, Gift Ideas, And Claims

## Context

Family members coordinating gifts need to see additions, edits, deletions, claims, and unclaims immediately across screens without manually refreshing or switching tabs. Surprise privacy must remain strictly enforced so that recipients never receive claims or hidden gift ideas about themselves in real-time streams.

## Decision

1. Use Firestore `onSnapshot` listeners to subscribe to wishes and gift ideas for the currently selected recipient, as well as claims for the selected recipient.
2. In `subscribeGiftIdeasForRecipient` and `subscribeClaimsForRecipient`, immediately short-circuit when the target recipient matches the current user to guarantee zero exposure of surprise data.
3. Use `subscribeMyClaims` in `MyClaimsScreen` to ensure claim lists stay live if claims or targets change.
4. Cleanly unsubscribe all listeners on component unmount or when changing active family/recipient.
5. In case of concurrent claims, rely on Firestore transactions to enforce a single claimant, display an inline friendly conflict notice to the runner-up, and update the UI in-place.
6. Provide an offline status indicator banner when network connectivity is lost so users understand real-time sync is paused until reconnected.

