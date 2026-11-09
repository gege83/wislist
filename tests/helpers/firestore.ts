import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, type Firestore } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export async function createFirestoreTestEnvironment(
  projectId: string,
): Promise<RulesTestEnvironment> {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  return initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
}

export interface FamilyFixtureMember {
  id: string;
  kind?: "adult" | "managedChild";
  admin?: boolean;
  guardianIds?: string[];
  removedAt?: string | null;
}

export async function seedFamilyFixture(
  firestore: Firestore,
  familyId: string,
  members: FamilyFixtureMember[],
): Promise<void> {
  const adminCount = members.filter(
    (member) => member.admin && !member.removedAt,
  ).length;
  await setDoc(doc(firestore, `families/${familyId}`), {
    name: `${familyId} Family`,
    createdBy:
      members.find((member) => member.admin)?.id ?? members[0]?.id ?? "owner",
    createdAt: new Date().toISOString(),
    deletedAt: null,
    adminCount,
  });

  for (const member of members) {
    await setDoc(doc(firestore, `families/${familyId}/members/${member.id}`), {
      kind: member.kind ?? "adult",
      displayName: member.id,
      ...(member.kind === "managedChild" ? {} : { userId: member.id }),
      admin: member.admin ?? false,
      ...(member.guardianIds ? { guardianIds: member.guardianIds } : {}),
      createdAt: new Date().toISOString(),
      createdBy: member.id,
      removedAt: member.removedAt ?? null,
    });
  }
}
