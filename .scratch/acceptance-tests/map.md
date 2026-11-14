# Acceptance Tests (Dave Farley Modern Software Engineering)

## Destination

An operational Dave Farley 4-layer acceptance testing framework located in `tests/acceptance/` with a decoupled driver interface (`WishlistDriver`), a subcutaneous multi-context adapter, and an initial executable specification suite covering Surprise Privacy and Gift Coordination running via `npm run test:acceptance`.

## Notes

- Domain language: Ubiquitous language from `GLOSSARY.md` (`Family`, `Family Member`, `Wish`, `Gift Idea`, `Claim`, `Surprise Privacy`, `Recipient`).
- Architecture: 4-layer model (1: Executable Specs in Vitest, 2: Domain DSL, 3: Protocol/Driver Interface, 4: SUT/Subcutaneous Adapter).
- Skills to consult: `domain-modeling`, `codebase-design`, `prototype`, `research`, `grilling`.
- Driver decoupling: Specifications must never reference DOM, selectors, or network details.

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Research Multi-User Subcutaneous App Context Isolation](issues/02-multi-user-subcutaneous-isolation.md): Isolated concurrent React sessions use detached DOM containers with `within(container)`, direct `AuthContext` injection, scoped `authenticatedContext(uid)` Firestore instances, and a `FirebaseContext` DI seam.
- [Prototype Domain DSL and Driver Interface](issues/01-domain-dsl-and-driver-prototype.md): Proven 4-layer architecture in `tests/acceptance/prototype/` with type-safe `WishlistAppDsl`/`MemberDsl` and decoupled `WishlistDriver` interface.

## Not yet specified

- **Playwright Browser Driver**: Implementing a headless browser adapter for `WishlistDriver` against running Vite dev server.
- **Extended Domain Acceptance Suites**: Executable specifications for Family Invites, Admin permissions, and Managed Child Profiles with Guardians.
- **Multi-session concurrency & performance**: Optimizing execution speed and memory footprint of concurrent in-memory React test trees.

## Out of scope

- **Replacing Firestore Rules unit tests**: Lower-level rules testing (`tests/rules/`) remains distinct from user acceptance testing.
- **Live Cloud Firebase execution**: Acceptance tests run exclusively against local Firebase emulators, not production cloud Firebase projects.

