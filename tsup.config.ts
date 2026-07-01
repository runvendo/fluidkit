import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Peer deps (react, react-dom, motion) and @samasante/liquid-glass (a regular
  // dependency but ESM-only) are excluded from the bundle by default because
  // tsup treats everything in "dependencies" and "peerDependencies" as
  // external. Listed explicitly here so the intent is documented and CJS
  // never tries to inline the ESM-only @samasante/liquid-glass package.
  external: ["react", "react-dom", "motion", "@samasante/liquid-glass"],
});
