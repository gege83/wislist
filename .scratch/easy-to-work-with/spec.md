## Problem Statement

Maintainers need to understand and safely change the main family workflows. The app shell coordinates many unrelated states and Firestore subscriptions, family operations mix invites, membership, and child-profile behavior, and several tests exercise Firestore directly without calling the production operations. This makes important behavior harder to locate and leaves changes to privacy-sensitive workflows with limited feedback.

## Solution

Give the family workspace and invite acceptance clear, testable module interfaces. Keep Firestore details and subscription lifecycle inside those modules, make invite acceptance an atomic operation, and exercise behavior at the highest useful seams: the production invite operation with the Firestore emulator, the workspace interface for selection and listener lifecycle, and Firestore rules through emulator-backed authorization tests. Consolidate repeated data mapping and emulator test setup where that improves locality.

## User Stories

1. As a maintainer, I want family selection and family-member selection handled in one focused module, so that the app shell can coordinate screens without owning Firestore subscription details.
2. As a maintainer, I want one clear workspace snapshot, so that callers can render the active Family, selected Family Member, Wishes, Gift Ideas, Claims, and loading or error state without rebuilding that state themselves.
3. As a maintainer, I want a small set of workspace actions for selecting a Family or Family Member, so that callers do not need to know how the workspace reloads data or replaces subscriptions.
4. As a family member, I want changing the selected Family to load that Family's members and data, so that I do not see stale information from the previous Family.
5. As a family member, I want changing the selected Family Member to replace the relevant live subscriptions, so that the displayed wishes, gift ideas, and claims match the selected person.
6. As a family member, I want subscriptions to stop when the workspace changes or is removed, so that obsolete updates do not overwrite current state.
7. As a family member, I want loading and subscription errors represented consistently, so that the interface can show useful feedback without duplicating error handling.
8. As an invite recipient, I want one operation to accept an Invite, so that I join the Family without the caller coordinating several Firestore writes.
9. As an invite recipient, I want acceptance to require an exact normalized email match, so that an Invite cannot be used by another account.
10. As an invite recipient, I want expired, revoked, rejected, or already accepted Invites rejected, so that only active Invites can grant membership.
11. As an invite recipient, I want acceptance to record the accepted Invite, create my Family Member record, and update my selected Family consistently, so that a partial failure does not leave me in an ambiguous state.
12. As an invite recipient, I want a clear success or failure result from acceptance, so that the app can refresh workspace state only after the operation succeeds.
13. As a family member, I want Wish, Gift Idea, and Claim documents mapped consistently, so that schema changes have one implementation location per domain type.
14. As a maintainer, I want the family and invite operations tested through their production interfaces, so that tests verify behavior callers actually depend on.
15. As a maintainer, I want emulator test setup and common Family fixtures shared, so that adding a behavior test requires less unrelated setup.
16. As a family member, I want Firestore rules to enforce Family membership, Admin, Guardian, and Surprise Privacy requirements for direct database access, so that authorization does not depend on the frontend.
17. As a family Admin, I want membership and role changes to preserve the requirement for at least one Admin, so that a Family cannot become unmanageable.
18. As a family Admin, I want only authorized Admins to manage membership, roles, Invites, and Family settings, so that other Family Members cannot grant themselves privileges.
19. As a Guardian, I want child-profile and Wish permissions to be checked for both allowed and denied cases, so that guardianship remains scoped to the correct Family Member.
20. As a claimant, I want My Claims to remain current as claims or targets change, so that the screen reflects the latest state.
21. As a maintainer, I want tests for listener cleanup, selection changes, and error paths, so that real-time behavior remains reliable during navigation.
22. As a maintainer, I want the behavior tests to assert visible outcomes and persisted state rather than internal implementation details, so that refactoring does not require rewriting the tests.

## Implementation Decisions

- Keep the existing product concepts and glossary terminology: Family, Family Member, Admin, Invite, Guardian, Wish, Gift Idea, Claim, and Surprise Privacy.
- Deepen invite acceptance behind one operation with a small result containing the joined Family identifier. Keep normalized-email checking, status and expiry validation, membership creation, and selected-Family update behind that interface.
- Make Invite acceptance state changes atomic so the Invite cannot be marked accepted without the corresponding membership update. Preserve clear errors for missing, mismatched, expired, revoked, rejected, and already accepted Invites.
- Introduce a family workspace module that owns Family and Family Member selection, relevant realtime subscriptions, and subscription cleanup. Keep screen navigation and modal presentation in the app shell.
- Keep the workspace interface focused on its observable snapshot and selection actions. Avoid exposing Firestore query details or individual subscription controls to screen callers.
- Use the Firestore emulator as the local adapter for testing production Firestore operations. Do not add a general-purpose repository or port solely for tests.
- Keep Firestore security rules as the authorization seam for direct access. Changes to rules must preserve the privacy decision in ADR 0001 and the live subscription behavior in ADR 0002.
- Add an authoritative Admin count to Family data. Initialize it when a Family is created, safely initialize existing Families, and update it atomically with Admin promotion, demotion, and removal so Firestore rules can preserve the at-least-one-Admin invariant.
- Consolidate document-to-domain mapping for Wishes, Gift Ideas, and Claims, and share emulator setup and stable test fixtures where they reduce duplication.
- Do not add user-facing product behavior as part of this work.

## Testing Decisions

- Good tests exercise the public module interface and assert outcomes callers or users can observe. They should not depend on private state, helper layout, or exact query implementation.
- Test Invite acceptance through the production operation against the Firestore emulator. Cover successful acceptance, normalized-email mismatch, expired/revoked/rejected/already-accepted Invites, membership creation, selected-Family update, and atomic failure behavior.
- Test the family workspace through its interface. Cover initial load, Family and Family Member changes, stale-state clearing, subscription replacement and cleanup, realtime data updates, and subscription errors.
- Test authorization directly against Firestore rules using the emulator. Cover allowed and denied access for Family Members, Admins, Guardians, managed child profiles, Wishes, Gift Ideas, Claims, and Surprise Privacy; include attempts to violate the at-least-one-Admin invariant.
- Test Admin-count initialization, increments, decrements, and failed concurrent or invalid changes against the Firestore emulator. Include a safe initialization path for existing Families.
- Keep and extend the existing emulator-backed realtime tests for live Wish, Gift Idea, and Claim updates. Add lifecycle assertions where the workspace interface owns listener cleanup.
- Add focused UI interaction tests only for behavior that cannot be adequately asserted at the workspace or Firestore seam, such as displaying claim conflicts or the relevant loading and error states.
- Replace direct Firestore-only tests for an operation when an interface-level test covers the same behavior; retain direct rules tests because Firestore rules are their own security seam.
- Prior art includes the existing Firestore rules tests, realtime synchronization tests, and invite-list refresh tests.

## Out of Scope

- New user-facing product features and visual redesign.
- Replacing Firebase or adding a second production database adapter.
- A broad rewrite of all screens or extracting every UI section into a separate module.
- Changing the real-time subscription strategy or weakening Surprise Privacy.
- Adding pagination or unrelated performance work.

## Further Notes

The work is intentionally sequenced around behavior first: establish tests at the existing production and rules seams, then deepen invite acceptance and workspace orchestration, then consolidate repeated mappings and test setup. Preserve any unrelated in-progress workspace changes while implementing this spec.
