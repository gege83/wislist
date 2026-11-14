# Research Multi-User Subcutaneous App Context Isolation

Type: research
Status: resolved

## Question

How can multiple authenticated React application sessions (`sessionFor("Alice")`, `sessionFor("Bob")`) run concurrently in Vitest + React Testing Library against the Firestore emulator without cross-session contamination (Firebase Auth state, Firestore listeners, global singletons, or DOM document collisions)?

## Answer

Multi-user subcutaneous React sessions can run concurrently with zero cross-session contamination via the following architectural pattern:

1. **DOM Isolation**: Each session mounts into a detached `HTMLDivElement` appended to `document.body` (`render(<App />, { container })`), and all user-action assertions use scoped queries via `within(container)`.
2. **Auth Context Bypassing Singletons**: Instead of relying on the module singleton `auth`, sessions pass `user` and `profile` directly into `AuthContext.Provider` around `<App />`.
3. **Firestore Security Context Isolation**: Each session acquires a separate Firestore instance via `testEnv.authenticatedContext(uid, { email }).firestore()` from `@firebase/rules-unit-testing`, enforcing accurate security rules per member.
4. **Firebase Dependency Injection Seam**: Complete the optional `firestoreInstance: Firestore = db` seam across mutative helpers (`createWish`, `claimItem`, etc.) and provide it to components via a light `FirebaseContext.Provider`, with production code safely defaulting to the singletons.
5. **Listener Teardown**: Calling RTL `unmount()` on session destruction triggers `useEffect` cleanup in `useFamilyWorkspace` and `App.tsx`, cleanly closing all Firestore `onSnapshot` listeners.


