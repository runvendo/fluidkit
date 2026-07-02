import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "liquid-metal": "src/liquid-metal/index.tsx",
    "water-field": "src/water-field/index.tsx",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Peer deps are excluded from the bundle by default because tsup treats
  // everything in "peerDependencies" as external. Listed explicitly here so
  // the intent is documented. The two GPU packages are optional peers used
  // only by the liquid-metal/water-field subpath entries — external here
  // keeps them out of every bundle, core included.
  external: [
    "react",
    "react-dom",
    "motion",
    "@paper-design/shaders-react",
    "webgl-fluid-enhanced",
  ],
});
