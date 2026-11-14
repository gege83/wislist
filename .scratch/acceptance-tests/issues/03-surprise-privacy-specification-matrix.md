# Executable Specification Matrix for Surprise Privacy

Type: grilling
Status: resolved
Blocked by: 01

## Question

What exact scenarios, preconditions, edge cases, and privacy leakage boundaries must be specified in the executable acceptance test suite for Surprise Privacy and Gift Coordination?

## Answer

The executable acceptance test specification for Surprise Privacy and Gift Coordination comprises the following canonical 6-scenario matrix:

1. **Wish Claiming (Surprise Privacy)**:
   - _Given_: Family with Adult Members Alice (Recipient), Bob, and Charlie. Alice adds a wish.
   - _When_: Bob claims Alice's wish.
   - _Then_: Bob and Charlie see the wish marked as claimed by Bob; Alice sees the wish as unclaimed.

2. **Wish Unclaiming (Release)**:
   - _Given_: Bob has claimed Alice's wish.
   - _When_: Bob unclaims the wish.
   - _Then_: Bob and Charlie see the wish return to unclaimed; Alice perceives no change.

3. **Gift Idea Secrecy**:
   - _Given_: Bob adds a hidden gift idea for Alice.
   - _When_: Family members view Alice's gift suggestions.
   - _Then_: Bob and Charlie see the gift idea; Alice cannot see or discover the gift idea in lists, searches, or counts.

4. **Gift Idea Claiming**:
   - _Given_: Bob created a gift idea for Alice.
   - _When_: Charlie claims Bob's gift idea for Alice.
   - _Then_: Bob and Charlie see that Charlie claimed the gift idea; Alice still has zero visibility into the idea or its claim.

5. **Self-Claim Prohibition**:
   - _Given_: Alice views her own wishes and ideas.
   - _When_: Alice attempts to claim her own wish or any idea where she is the recipient.
   - _Then_: The action is prevented by domain rules and UI controls.

6. **Concurrent Claim Race Condition**:
   - _Given_: Alice has an unclaimed wish; both Bob and Charlie attempt to claim it simultaneously.
   - _When_: Both claim operations are submitted concurrently.
   - _Then_: Exactly one member's claim succeeds, the other receives an error/notification that the wish was already claimed, both non-recipient views converge via real-time push to show the single winning claimant, and Alice's Surprise Privacy is preserved throughout.

**Boundaries & Environment**:

- **Real-time Push**: Multi-user session convergence occurs automatically through live Firestore listeners without manual refresh.
- **Out of Scope for this Suite**: Managed Child Profile guardianship visibility and cross-family boundaries are deferred to dedicated suites.
