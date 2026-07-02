import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Peer deps are excluded from the bundle by default because tsup treats
  // everything in "peerDependencies" as external. Listed explicitly here so
  // the intent is documented.
  external: ["react", "react-dom", "motion"],
});
