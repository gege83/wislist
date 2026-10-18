# Add Firebase Rules And Emulator Tests

Status: ready-for-agent
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
