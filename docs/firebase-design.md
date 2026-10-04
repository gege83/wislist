# Firebase Technical Design

## Stack

- React + Vite + TypeScript
- Tailwind CSS and shadcn/ui-style components
- Firebase Auth
- Firestore
- Firebase Hosting
- Firebase local emulators for Auth and Firestore
- GitHub Actions deployment to production

The project uses local emulators plus production. There is no separate hosted development Firebase project in v1.

## Security Boundary

Firestore security rules are the source of truth for privacy. Frontend filtering is only presentation. A recipient must not be able to read hidden gift ideas, claims, or planning data about themselves by changing client code or querying Firestore directly.

Security-rule tests run against the Firebase emulator and are treated as first-class tests.

## Data Model Draft

This model favors secure and understandable reads over perfect normalization.

### `users/{userId}`

- `displayName`
- `email`
- `normalizedEmail`
- `createdAt`
- `lastSelectedFamilyId`

### `families/{familyId}`

- `name`
- `deletedAt`
- `createdAt`
- `createdBy`

### `families/{familyId}/members/{memberId}`

For signed-in adults, `memberId` is the user ID. For managed child profiles, `memberId` is a generated profile ID.

- `kind`: `adult` or `managedChild`
- `displayName`
- `userId`: for adults
- `admin`: adult members only
- `guardianIds`: managed child profiles only
- `createdAt`
- `createdBy`
- `removedAt`

### `invites/{inviteId}`

- `familyId`
- `email`
- `normalizedEmail`
- `createdAt`
- `createdBy`
- `expiresAt`
- `acceptedAt`
- `acceptedBy`
- `revokedAt`

### `wishes/{wishId}`

- `recipientId`
- `creatorId`
- `title`
- `description`
- `visibleFamilyIds`
- `status`: `available` or `deleted`
- `createdAt`
- `deletedAt`

### `giftIdeas/{giftIdeaId}`

- `recipientId`
- `creatorId`
- `title`
- `description`
- `createdAt`
- `deletedAt`

Gift idea visibility is derived from shared family membership between creator and recipient, excluding the recipient. Guardians can read gift ideas for managed child profiles they guard.

### `claims/{claimId}`

Use deterministic IDs to enforce one active claim per target:

- wish claim: `wish_{wishId}`
- gift idea claim: `giftIdea_{giftIdeaId}`

Fields:

- `targetType`: `wish` or `giftIdea`
- `targetId`
- `recipientId`
- `claimantId`
- `createdAt`

Claim creation uses a Firestore transaction that succeeds only when the claim document does not already exist.

## Cloud Functions

V1 should avoid Cloud Functions unless they materially simplify the app. Likely uses:

- optional invite email sending
- later cleanup of expired invites

Claims, wish creation, invite acceptance, and privacy enforcement should work through client writes plus Firestore rules where practical.

## Deployment

GitHub Actions deploys the app to Firebase Hosting production. Local development runs against Firebase emulators by default.
