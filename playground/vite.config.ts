import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The playground renders the library straight from source (../src) so we get
// instant feedback without a build step. It lives in its own root dir; allow
// Vite to serve files from the repo root (one level up) for those imports.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
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
