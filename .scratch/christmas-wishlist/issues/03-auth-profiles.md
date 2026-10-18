# Build Auth And User Profiles

Status: resolved
Type: task
Blocked by: 01

Implement Google and email/password sign-in, immediate app profile creation, display name management, and normalized email handling for invites.

## Acceptance Criteria

- Users can sign in with Google.
- Users can sign in with email/password.
- A profile document is created after first sign-in.
- Profile stores display name, email, normalized email, and last selected family.

## Comments

- Added authentication service in `src/lib/auth.ts` supporting Google sign-in, email/password sign-in/up, profile syncing (`users/{uid}`), email normalization, and profile updates.
- Added `AuthProvider` and `useAuth` hook in `src/context/` managing authentication state.
- Created `AuthScreen` component (`src/components/AuthScreen.tsx`) allowing users to switch between Google auth and email/password sign-in/up.
- Added tests in `tests/auth/auth.test.ts` verifying profile creation, email normalization, profile updating, and cross-user write prevention.
