# Build Wishes

Status: resolved
Type: task
Blocked by: 04, 05

Implement visible wishes for adults and managed child profiles.

## Acceptance Criteria

- Users can create, edit, and delete their own wishes.
- Guardians can create, edit, and delete child wishes.
- New wishes default to all recipient families checked.
- Wish fields are title, description, recipient, creator, created date, visible families, and status.
- Deleted claimed wishes remain visible to the claimant and are marked removed.

## Comments

- Implemented `createWish`, `updateWish`, `deleteWish`, `getWishesForFamilyMember`, `getActiveWishesForRecipient`, and `getWishById` in `src/lib/wishes.ts`.
- Supported adult wish creation and editing, as well as guardian management for child wishes.
- Validated `visibleFamilyIds` scoping and soft-deletion (`status: 'deleted'`).
- Added tests in `tests/wishes/wishes.test.ts` verifying wish CRUD, guardian management for managed child wishes, and claimant visibility for deleted wishes.
