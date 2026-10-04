# Enforce Surprise Privacy In Firestore Rules

Surprise privacy is the central product promise: a recipient must not be able to read hidden gift ideas, claims, or planning data about themselves. We will enforce this with Firestore security rules and emulator tests rather than relying on frontend filtering, because client-only hiding would be easy to bypass and would make the most important behavior depend on presentation code.
