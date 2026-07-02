import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The playground renders the library straight from source (../src) so we get
// instant feedback without a build step. It lives in its own root dir; allow
// Vite to serve files from the repo root (one level up) for those imports.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  // Demo recipes import from "fluidkit" so their displayed source reads
  // exactly like consumer code; the alias points it at ../src. The GPU
  // subpaths ("fluidkit/liquid-metal", "fluidkit/water-field") get their own
  // entries pointing straight at their source files. Array form (not object
  // form) so these are tried IN ORDER: alias resolution (via
  // @rollup/plugin-alias under the hood) matches a string `find` on either
  // an exact specifier or a "<find>/..." prefix, so a bare "fluidkit" entry
  // would otherwise swallow "fluidkit/liquid-metal" first and rewrite it to
  // a nonsense "../src/index.ts/liquid-metal" path — the more specific
  // subpath entries must come before the generic "fluidkit" one.
  resolve: {
    alias: [
      { find: "fluidkit/liquid-metal", replacement: fileURLToPath(new URL("../src/liquid-metal/index.tsx", import.meta.url)) },
      { find: "fluidkit/water-field", replacement: fileURLToPath(new URL("../src/water-field/index.tsx", import.meta.url)) },
      { find: "fluidkit", replacement: fileURLToPath(new URL("../src/index.ts", import.meta.url)) },
    ],
  },
  server: {
    fs: { allow: [".."] },
  },
  // `npm run build:site` bundles the playground into a deployable static
  // site at the repo root.
  build: {
    outDir: "../dist-site",
    emptyOutDir: true,
  },
});
