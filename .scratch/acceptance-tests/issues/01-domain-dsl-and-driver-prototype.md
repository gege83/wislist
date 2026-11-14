# Prototype Domain DSL and Driver Interface

Type: prototype
Status: resolved

## Question

What is the concrete API design for the 4-layer acceptance test DSL in TypeScript, and how does `WishlistDriver` express domain intents (Given/When/Then actions using `GLOSSARY.md` terms) while keeping test specifications clean, type-safe, and decoupled from UI or driver mechanics?

## Answer

A validated, working prototype of the 4-layer acceptance test architecture was implemented and verified with Vitest and TypeScript in `tests/acceptance/prototype/`:

1. **Layer 1: Executable Specification** (`tests/acceptance/prototype/surprise-privacy.prototype.test.ts`):
   - Reads strictly in ubiquitous domain language from `GLOSSARY.md`.
   - Free of DOM selectors, React handles, HTTP requests, or Firestore paths.
2. **Layer 2: Domain DSL** (`tests/acceptance/prototype/dsl.ts`):
   - Provides `WishlistAppDsl`, `FamilyDsl`, `MemberDsl`, and `WishAssertionDsl`.
   - Offers fluent, type-safe builders (`alice.addsWish(...)`, `bob.claimsWish(wish)`, `alice.expectsWish(wish).toNotBeClaimed()`).
3. **Layer 3: Driver Port** (`tests/acceptance/prototype/WishlistDriver.ts`):
   - Exposes clean domain operations (`sessionFor`, `addWish`, `claimWish`, `addGiftIdeaFor`, `getWishesFor`, `getGiftIdeasFor`).
   - Completely decouples the test specifications from the underlying driver adapter.
4. **Validation**:
   - Tested against `InMemorySimulatedDriver.ts` with passing test runs (`npx vitest run tests/acceptance/prototype/surprise-privacy.prototype.test.ts`) and zero TypeScript compiler warnings (`npm run typecheck`).


