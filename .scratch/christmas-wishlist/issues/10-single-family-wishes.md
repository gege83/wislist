# Single Family Wishes Visibility

Status: resolved
Type: task
Blocked by: 06

Refactor wish visibility so every wish belongs to a single family (`familyId: string`) and is visible only to members of that family.

## Acceptance Criteria

- `Wish` interface and documents store `familyId: string` instead of `visibleFamilyIds: string[]`.
- Firestore security rules allow wish reads only for active members of `familyId`.
- Creating a wish requires active membership in `familyId`, and the creator must be the recipient or their guardian in that family.
- `familyId` is immutable on update.
- `WishModal` creates wishes bound implicitly to the active family; multi-family selection UI is removed.
- "My Wishes" view is filtered to display only wishes for the active family.
- All tests updated and passing.

## Comments

- Replaced `visibleFamilyIds: string[]` with `familyId: string` across `src/types/index.ts`, `src/lib/wishes.ts`, `docs/firebase-design.md`, and `GLOSSARY.md`.
- Updated Firestore security rules for `/wishes/{wishId}`:
  - Read: authenticated and `isFamilyMember(resource.data.familyId)`.
  - Create: authenticated, creator is auth user, member of `familyId`, and is recipient or guardian.
  - Update: authenticated, member of `familyId`, cannot change `familyId`, and is creator/recipient/guardian.
  - Removed obsolete `isVisibleWishReader` helper.
- Updated `WishModal.tsx` to bind wishes implicitly to `currentFamilyId` without multi-family checkboxes.
- Scoped "My Wishes" view to the currently selected active family in `src/App.tsx`.
- Updated tests across `tests/rules/rules.test.ts`, `tests/wishes/wishes.test.ts`, `tests/claims/claims.test.ts`, and `tests/claims/my-claims.test.ts`.
