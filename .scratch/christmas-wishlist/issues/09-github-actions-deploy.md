# Add GitHub Actions Deployment

Status: resolved
Type: task
Blocked by: 01

Configure GitHub Actions to test and deploy the app to Firebase Hosting production.

## Acceptance Criteria

- CI installs dependencies and runs checks.
- Deployment is triggered from the main branch.
- Firebase project ID and token/service credentials are read from GitHub secrets.
- The workflow does not require a separate dev Firebase project.

## Comments

- GitHub Actions deployment workflow added. Repository secrets still need to be configured in GitHub: `FIREBASE_PROJECT_ID` and `FIREBASE_TOKEN`.
