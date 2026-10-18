# Build Gift Ideas And Claims

Status: resolved
Type: task
Blocked by: 06

Implement hidden gift ideas and one-claimant claims for wishes and gift ideas.

## Acceptance Criteria

- Non-recipient adults can add gift ideas for recipients they share a family with.
- Recipients cannot see gift ideas targeting themselves.
- Guardians can see gift ideas for managed child profiles they guard.
- Users can claim and unclaim wishes and gift ideas.
- Claims are created with a transaction so concurrent claims resolve to one winner.

## Comments

- Implemented `createGiftIdea`, `getGiftIdeasForRecipient`, and `deleteGiftIdea` in `src/lib/giftIdeas.ts`.
- Implemented `claimItem`, `unclaimItem`, `getClaimsForFamily`, and `getMyClaims` in `src/lib/claims.ts`.
- Used Firestore transactions with deterministic claim IDs (`wish_{wishId}` and `giftIdea_{giftIdeaId}`) to ensure race-safe single-claimant enforcement.
- Maintained surprise privacy in rules and SDK methods so recipients cannot access gift ideas or claims targeting themselves.
- Added tests in `tests/claims/claims.test.ts` verifying gift idea privacy, claiming, unclaiming, and transaction conflict handling.
