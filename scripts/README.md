# Firestore data migrations

Before deploying the rules that require Admin counts, run the migration against the intended Firebase project:

```sh
FIREBASE_PROJECT_ID=your-project-id npm run migrate:family-admin-count
```

The command uses Application Default Credentials and updates only Families without an Admin count. It counts active Admin Family Members in a Firestore transaction. Families with no active Admin stop the migration for manual repair. The same command backfills typed Invite expiration timestamps so the rules can enforce Invite expiry during acceptance.

For the Firestore emulator, set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `FIREBASE_PROJECT_ID` before running the command.
