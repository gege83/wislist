import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SESSION_CONTAINER_ATTR = "data-acceptance-session";

export async function createAcceptanceTestEnvironment(
  suiteName: string,
): Promise<RulesTestEnvironment> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  process.env.FIRESTORE_EMULATOR_HOST = host;

  const [hostName, portStr] = host.split(":");
  const port = portStr ? parseInt(portStr, 10) : 8080;

  const rulesPath = resolve(process.cwd(), "firestore.rules");
  const rules = readFileSync(rulesPath, "utf8");

  const projectId = `wishlist-acceptance-${suiteName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;

  return initializeTestEnvironment({
    projectId,
    firestore: {
      rules,
      host: hostName,
      port,
    },
  });
}

export function createSessionContainer(memberName: string): HTMLDivElement {
  const container = document.createElement("div");
  container.setAttribute(SESSION_CONTAINER_ATTR, memberName.toLowerCase());
  document.body.appendChild(container);
  return container;
}

export function cleanupSessionContainers(): void {
  const containers = document.querySelectorAll(`[${SESSION_CONTAINER_ATTR}]`);
  containers.forEach((container) => container.remove());
}
