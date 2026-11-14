# Configure Acceptance Test Harness and Runner

Type: task
Status: resolved
Blocked by: 01, 02

## Question

What configuration (Vitest config, npm `test:acceptance` script, emulator execution harness, and state cleanup hooks) is required to run acceptance tests deterministically in isolation against the Firestore emulator?

## Answer

The acceptance test harness and runner configuration has been set up with the following components:

1. **Dedicated Vitest Configuration** (`vitest.acceptance.config.ts`):
   - Sets `environment: "jsdom"` with `globals: true` and a 20s test timeout.
   - Restricts test matching to `tests/acceptance/**/*.acceptance.test.ts`, isolating acceptance tests from unit and prototype runs.
   - Registers `tests/acceptance/harness/setup.ts` to automatically set up `@testing-library/jest-dom/vitest` matchers and clean up multi-session containers after each test.

2. **Harness Module** (`tests/acceptance/harness/acceptanceHarness.ts`):
   - `createAcceptanceTestEnvironment(suiteName)`: Dynamically spins up `@firebase/rules-unit-testing` `RulesTestEnvironment` with `firestore.rules` against the emulator host (`127.0.0.1:8080`) using unique project IDs per run.
   - `createSessionContainer(memberName)`: Appends an isolated, tagged `HTMLDivElement` to `document.body` for each user session.
   - `cleanupSessionContainers()`: Cleans up all session containers from the DOM.

3. **NPM Scripts** (`package.json`):
   - `"test:acceptance": "firebase emulators:exec --only firestore \"vitest run -c vitest.acceptance.config.ts\""`: Full lifecycle command that starts emulators, runs acceptance tests, and stops emulators.
   - `"test:acceptance:local": "vitest run -c vitest.acceptance.config.ts"`: Fast runner for local development when emulators are already active.
