# Build Families And Invites

Status: resolved
Type: task
Blocked by: 03

Implement family creation, admin membership, email-addressed invites, invite acceptance, and family deletion.

## Acceptance Criteria

- Signed-in users without membership can create a family.
- Admins can invite by email.
- Invites expire after 2 days.
- Users see active invites addressed to their normalized email.
- Users must manually accept invites.
- Families cannot be left with zero admins.
- Admins can soft-delete families.

## Comments

- Implemented `createFamily`, `createInvite`, `getPendingInvitesForEmail`, `acceptInvite`, `softDeleteFamily`, `removeFamilyMember`, and `toggleAdminRole` in `src/lib/families.ts`.
- Enforced admin constraints ensuring a family cannot be left with zero admins.
- Supported 2-day invite expiration with normalized email matching upon acceptance.
- Added test coverage in `tests/families/families.test.ts` for family creation, invite generation, manual acceptance, and soft deletion.
