import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanupSessionContainers } from "./acceptanceHarness";

afterEach(() => {
  cleanupSessionContainers();
});
