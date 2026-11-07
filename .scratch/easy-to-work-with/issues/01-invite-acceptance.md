# 01: Make Invite acceptance atomic

**What to build:** An invite recipient can accept an active Invite with one operation. Acceptance verifies the normalized email and Invite status, creates the adult Family Member, marks the Invite accepted, and selects the joined Family as one consistent result. The app refreshes its invite and Family views only after success.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Successful acceptance records the accepting user and time, creates a non-admin adult Family Member, and updates the user's selected Family.
- [ ] The Invite, membership, and profile changes are atomic; a failed operation does not leave a partial acceptance.
- [ ] Missing, mismatched-email, expired, revoked, rejected, and already-accepted Invites fail with clear errors and no writes.
- [ ] The UI refreshes pending/sent invite lists and loads the joined Family only after acceptance succeeds.
- [ ] Firestore emulator tests call the production acceptance operation and verify persisted success and failure outcomes.

