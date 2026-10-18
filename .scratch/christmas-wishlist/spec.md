# Christmas Wishlist MVP Spec

Build a Firebase web app that lets families share visible Christmas wishes while hiding gift planning from recipients.

Canonical product behavior lives in `docs/product-spec.md`. Firebase architecture lives in `docs/firebase-design.md`. Domain terms live in `GLOSSARY.md`.

## Implementation Order

1. Scaffold the React + Vite + TypeScript app.
2. Add Firebase config, emulator setup, and Firestore rules.
3. Write emulator tests for surprise privacy and claim races.
4. Build auth and profile creation.
5. Build family creation, membership, invites, and invite acceptance.
6. Build managed child profiles and guardians.
7. Build wishes.
8. Build gift ideas and claims.
9. Build My Claims.
10. Add GitHub Actions deployment.
