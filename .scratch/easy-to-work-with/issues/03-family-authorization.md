# 03: Enforce Family Admin and Guardian permissions

**What to build:** Family administration and managed child profile actions remain authorized even when callers write directly to Firestore. Each Family keeps at least one Admin, and Admin and Guardian permissions apply consistently to membership, roles, Invites, settings, and managed child profiles.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Family documents store an authoritative Admin count; new Families initialize it correctly, and a safe migration initializes existing Families before count-dependent changes are enabled.
- [ ] Admin promotion, demotion, and removal update the count and member record atomically.
- [ ] Firestore rules permit count changes only when paired with the corresponding authorized membership change, and reject demotion or removal of the last Admin.
- [ ] Admin and non-Admin authorization is covered for Invite creation, Family settings, role changes, and member removal, including permitted self-removal behavior.
- [ ] Managed child creation and Guardian assignment are covered for Admins, existing Guardians, other Family Members, and outsiders.
- [ ] Wish authorization is covered for recipients and Guardians, including denied writes by unauthorized Family Members.
- [ ] Removed Family Members and members of another Family cannot access Family-scoped data; Surprise Privacy for Gift Ideas and Claims remains intact.
- [ ] Emulator tests exercise allowed and denied direct Firestore operations; the rules smoke placeholder is replaced with meaningful coverage or removed.
- [ ] Shared emulator setup and Family fixtures are introduced where they reduce duplication in the authorization tests.

