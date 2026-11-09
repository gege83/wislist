import { applicationDefault, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { pathToFileURL } from "node:url";
import { console } from "node:console";
import process from "node:process";

export async function migrateFamilyAdminCounts(firestore) {
  const families = await firestore.collection("families").get();
  let migrated = 0;

  for (const family of families.docs) {
    if (Number.isInteger(family.data().adminCount)) continue;
    const familyRef = family.ref;
    const didMigrate = await firestore.runTransaction(async (transaction) => {
      const latestFamily = await transaction.get(familyRef);
      if (
        !latestFamily.exists ||
        Number.isInteger(latestFamily.data().adminCount)
      )
        return false;

      const members = await transaction.get(familyRef.collection("members"));
      const adminCount = members.docs.filter(
        (member) =>
          member.data().admin === true && member.data().removedAt == null,
      ).length;
      if (adminCount < 1) {
        throw new Error(
          `Family ${familyRef.id} has no active Admin; repair its membership before migrating.`,
        );
      }
      transaction.update(familyRef, { adminCount });
      return true;
    });
    if (didMigrate) migrated++;
  }

  let expiryFieldsMigrated = 0;
  const invites = await firestore.collection("invites").get();
  for (const invite of invites.docs) {
    if (invite.data().expiresAtTimestamp instanceof Timestamp) continue;
    const expiresAt = new Date(invite.data().expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error(`Invite ${invite.id} has an invalid expiresAt value.`);
    }
    const didMigrate = await firestore.runTransaction(async (transaction) => {
      const latestInvite = await transaction.get(invite.ref);
      if (
        !latestInvite.exists ||
        latestInvite.data().expiresAtTimestamp instanceof Timestamp
      )
        return false;
      if (latestInvite.data().expiresAt !== invite.data().expiresAt) {
        throw new Error(
          `Invite ${invite.id} changed during migration; run the migration again.`,
        );
      }
      transaction.update(invite.ref, {
        expiresAtTimestamp: Timestamp.fromDate(expiresAt),
      });
      return true;
    });
    if (didMigrate) expiryFieldsMigrated++;
  }

  return { migrated, expiryFieldsMigrated };
}

async function main() {
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error(
      "Set FIREBASE_PROJECT_ID to the project you intend to migrate.",
    );
  }
  const app = initializeApp(
    process.env.FIRESTORE_EMULATOR_HOST
      ? { projectId: process.env.FIREBASE_PROJECT_ID }
      : {
          projectId: process.env.FIREBASE_PROJECT_ID,
          credential: applicationDefault(),
        },
  );
  const result = await migrateFamilyAdminCounts(getFirestore(app));
  console.log(
    `Migrated Admin counts on ${result.migrated} Families and expiry timestamps on ${result.expiryFieldsMigrated} Invites.`,
  );
  await app.delete();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
