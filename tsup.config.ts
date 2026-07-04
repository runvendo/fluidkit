import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "liquid-metal": "src/liquid-metal/index.tsx",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Peer deps are excluded from the bundle by default because tsup treats
  // everything in "peerDependencies" as external. Listed explicitly here so
  // the intent is documented. The GPU package is an optional peer used
  // only by the liquid-metal subpath entry — external here keeps it out
  // of every bundle, core included.
  external: [
    "react",
    "react-dom",
    "motion",
    "@paper-design/shaders-react",
  ],
});
