# Build Managed Child Profiles

Status: resolved
Type: task
Blocked by: 04

Implement managed child profiles and guardian management.

## Acceptance Criteria

- Any adult family member can create a managed child profile.
- Admins and existing guardians can add or remove guardians.
- Managed child profiles appear in the family member list.
- Managed child profiles belong to one family in v1.

## Comments

- Added `createManagedChildProfile` and `updateChildGuardians` in `src/lib/families.ts`.
- Enforced guardian management permissions (only admins and existing guardians can modify child guardians).
- Confirmed managed child profiles belong to one family under `families/{familyId}/members/{memberId}`.
- Added comprehensive unit tests in `tests/families/child-profiles.test.ts` verifying adult creation, guardian modifications, and outsider restrictions.
