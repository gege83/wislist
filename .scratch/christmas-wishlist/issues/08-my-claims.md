# Build My Claims

Status: resolved
Type: task
Blocked by: 07

Create a screen that lists everything the current user has claimed.

## Acceptance Criteria

- The screen lists claimed wishes and gift ideas.
- Deleted claimed wishes remain visible and show that they were removed from the recipient's list.
- Users can unclaim from this screen.

## Comments

- Built `MyClaimsScreen` in `src/components/MyClaimsScreen.tsx` listing all claimed wishes and gift ideas.
- Maintained visibility of deleted claimed wishes with a dedicated "Removed from recipient's list" badge.
- Added interactive unclaiming directly from the claims list.
- Wired view navigation in `src/App.tsx` between Family, My Wishes, and My Claims views.
- Added tests in `tests/claims/my-claims.test.ts` verifying claim listing, deleted wish retention, and unclaim action.
