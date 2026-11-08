# 02: Put Family workspace state behind a focused module

**What to build:** A family member can switch Families and select Family Members while the app keeps the visible Wishes, Gift Ideas, and Claims current. The app shell uses a focused workspace interface; that module owns selection data loading, live subscriptions, stale-state clearing, and listener cleanup.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The workspace exposes a coherent snapshot and focused Family and Family Member selection actions without exposing Firestore query or listener details to screen callers.
- [x] Switching Family or Family Member loads the matching data, clears stale data, and replaces the relevant live subscriptions.
- [x] Listeners are stopped when selection changes and when the workspace is removed; obsolete updates cannot overwrite current state.
- [x] Live Wish, Gift Idea, and Claim updates remain visible, and selecting the current user never exposes their Gift Ideas or Claims.
- [x] Loading, empty, and error states remain usable through the app's existing workflows.
- [x] Repeated Wish, Gift Idea, and Claim document mapping is consolidated across reads and subscriptions where it improves locality.
- [ ] Emulator tests cover selection changes, realtime updates, privacy behavior, errors, and listener cleanup through the workspace interface.
