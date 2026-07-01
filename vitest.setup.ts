import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library's automatic cleanup only registers when Vitest `globals` is
// enabled, which this project keeps off. Register it once here so every test
// file that mounts DOM (all the component tests) gets torn down between tests.
afterEach(() => {
  cleanup();
});
