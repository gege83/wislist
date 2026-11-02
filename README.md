# Christmas Wishlist

Christmas Wishlist is a private family web app for sharing Christmas wishes and coordinating gifts while keeping surprise planning hidden from recipients. Family members can manage their own wishes, add hidden gift ideas for others, and claim gifts so other members know they are being handled. The app supports multiple families per user and managed child profiles.

Surprise privacy is enforced by Firestore security rules. Recipients cannot read gift ideas or claims about themselves, even by querying Firestore directly. See [the product spec](docs/product-spec.md), [Firebase design](docs/firebase-design.md), and [glossary](GLOSSARY.md) for the product and domain details.

## Tech stack

- React 19, TypeScript, and Vite
- Firebase Authentication and Cloud Firestore
- Firebase Hosting and local Firebase emulators for Auth and Firestore
- Vitest, Testing Library, and Firebase Rules Unit Testing

## Requirements

Install a current Node.js release compatible with the versions in `package.json` and npm. Firebase emulator commands use the `firebase-tools` development dependency; Java may also be required by the Firebase emulators. If emulator startup reports a missing Java runtime, install a supported JDK and retry.

## Getting started

1. Clone the repository and enter its directory.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a Firebase project for production and configure a local `.env.local` with the Firebase web app settings. The app reads the variables declared in `src/vite-env.d.ts`; use the `VITE_` prefix for client-side configuration. Never put service account credentials or other secrets in client environment variables.
4. Start the local Auth and Firestore emulators in one terminal:

   ```sh
   npx firebase emulators:start --only auth,firestore
   ```

5. In another terminal, start the app:

   ```sh
   npm run dev
   ```

   Open the local URL printed by Vite. The emulator UI is available at `http://localhost:4000` when enabled in `firebase.json`.

The app is intended to use the local emulators during development. It does not have a separate hosted development Firebase project in v1. Check `src/lib/firebase.ts` for the exact environment variable names and emulator connection behavior before configuring a new environment.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build the production frontend into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the full Vitest suite |
| `npm run test:rules` | Run Firestore rules tests |

Firebase-backed tests may require the local emulators. Inspect the test setup and `firebase.json` if a test reports emulator connection errors.

## Project layout

- `src/components/` — screens, dialogs, and UI components
- `src/context/` — authentication context and provider
- `src/lib/` — Firebase access and domain operations for auth, families, wishes, gift ideas, and claims
- `src/types/` — shared TypeScript domain types
- `tests/` — unit, integration, realtime, and Firestore security-rule tests
- `docs/product-spec.md` — product scope and behavior
- `docs/firebase-design.md` — Firebase architecture and data model
- `docs/adr/` — architecture decision records
- `firestore.rules` — Firestore authorization and privacy rules
- `firestore.indexes.json` — required Firestore indexes
- `firebase.json` — Hosting, emulator, rules, and index configuration

## Contributing

Before changing product behavior, read `docs/product-spec.md`, `GLOSSARY.md`, and relevant decisions in `docs/adr/`. Follow the domain terminology in the glossary. See `docs/agents/domain.md` for repository-specific domain documentation guidance and `docs/agents/issue-tracker.md` for local issue conventions.

When contributing:

- Keep recipient surprise privacy as a security boundary. Frontend filtering is not sufficient; update and test Firestore rules for access changes.
- Add or update tests alongside behavior changes. Security-sensitive work should include emulator-backed rule tests.
- Keep the app usable across multiple families and for both adult members and managed child profiles.
- Run the relevant checks before submitting changes:

  ```sh
  npm run lint
  npm test
  npm run build
  ```

- Describe behavior changes and any Firebase rules or index updates in your pull request. Do not commit credentials, local environment files, generated build output, or emulator data.

## Deployment

Firebase Hosting serves the Vite build from `dist/` and rewrites application routes to `index.html`. Production deployment is configured through GitHub Actions; see the repository workflow configuration when preparing a release. Build locally with `npm run build` before deployment. Firestore rules and indexes are configured in `firebase.json`.
