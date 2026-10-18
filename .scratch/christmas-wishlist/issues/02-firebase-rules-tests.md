# Add Firebase Rules And Emulator Tests

Status: resolved
Type: task
Blocked by: 01

Create Firestore rules and emulator tests for the core privacy model.

## Acceptance Criteria

- Recipients cannot read gift ideas for themselves.
- Recipients cannot read claims targeting their own wishes or gift ideas.
- Non-recipient family members can read visible wishes and allowed gift ideas.
- Guardians can read gift ideas for managed child profiles they guard.
- Claim creation enforces one active claimant per target.

## Comments

- Added complete Firestore security rules in `firestore.rules` covering users, families, members, invites, wishes, giftIdeas, and claims.
- Implemented core surprise privacy guarantees (denying recipients access to hidden gift ideas and claims targeting their wishes or gift ideas).
- Added unit tests in `tests/rules/rules.test.ts` running against the Firestore emulator for surprise privacy, guardian access to child gift ideas, family member visibility, and deterministic claim race handling.
