import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));

// The three published entry points. Must run AFTER `npm run build` — this
// imports the BUILT package (dist/), never src/, so it proves the actual
// published artifact is SSR-safe (no top-level window/document access, no
// component that throws when rendered outside a browser).
const distFiles = ["dist/index.js", "dist/liquid-metal.js", "dist/water-field.js"];

// Explicit minimal props per exported component — house style (see
// check-no-gpu-deps.mjs / check-pack.mjs) is explicit lists over magic.
// Every capital-letter function export discovered in the dist files below
// MUST have an entry here; an undiscovered/unmapped export fails the check
// (see the "no entry" branch) so a newly added component can't slip through
// un-SSR-tested.
const MINIMAL_PROPS = {
  Droplets: {},
  Thinking: {},
  MorphSurface: { open: false },
  FlowStagger: { children: h("div", null, "item") },
  LiquidTabs: { items: [{ id: "a", label: "A" }] },
  Ripple: { children: h("div", null, "content") },
  JellyButton: {},
  Magnetic: { children: h("div", null, "content") },
  LiquidDrag: { children: h("div", null, "content") },
  DripFuse: {},
  MeshGradient: {},
  Aurora: {},
  LiquidMetal: {},
  WaterField: {},
};

// React reports SSR problems (useLayoutEffect-on-server, invalid nesting,
// hydration-shape warnings, ...) via console.error WITHOUT throwing, so a
// throw-only gate would let them regress silently. Any console.error emitted
// while importing or rendering fails the check unless a pattern here matches.
// Empty on purpose: the render is fully warning-clean today, and any new
// noise should fail loudly until someone consciously allowlists it.
const ALLOWED_CONSOLE_PATTERNS = [];

/** Runs `fn` with console.error intercepted; returns [result, violations].
 * Rethrows nothing — a throw from `fn` propagates after console.error is
 * restored, so the caller's try/catch still sees it. */
async function withConsoleErrorCapture(fn) {
  const violations = [];
  const realConsoleError = console.error;
  console.error = (...args) => {
    const message = args
      .map((a) => (typeof a === "string" ? a : String(a)))
      .join(" ");
    if (!ALLOWED_CONSOLE_PATTERNS.some((pattern) => pattern.test(message))) {
      violations.push(message);
    }
    realConsoleError(...args);
  };
  try {
    return [await fn(), violations];
  } finally {
    console.error = realConsoleError;
  }
}

let hasErrors = false;
let renderedCount = 0;

for (const distFile of distFiles) {
  const distPath = path.join(rootDir, distFile);

  if (!existsSync(distPath)) {
    console.error(`✗ ${distFile} not found. Run npm run build first.`);
    process.exit(1);
  }

  let mod;
  try {
    let importViolations;
    [mod, importViolations] = await withConsoleErrorCapture(
      () => import(pathToFileURL(distPath).href)
    );
    for (const violation of importViolations) {
      console.error(`✗ ${distFile} emitted console.error during import: ${violation}`);
      hasErrors = true;
    }
  } catch (error) {
    console.error(`✗ Failed to import ${distFile}: ${error.stack ?? error.message}`);
    hasErrors = true;
    continue;
  }

  for (const [name, value] of Object.entries(mod)) {
    // Components are capital-letter function exports; hooks (useX) and
    // utils (resolveColor, ...) are excluded by the capital-letter filter.
    if (typeof value !== "function" || !/^[A-Z]/.test(name)) continue;

    if (!(name in MINIMAL_PROPS)) {
      console.error(
        `✗ ${distFile} exports component "${name}" with no MINIMAL_PROPS entry in scripts/check-ssr.mjs — add one.`
      );
      hasErrors = true;
      continue;
    }

    try {
      const [markup, renderViolations] = await withConsoleErrorCapture(() =>
        renderToString(h(value, MINIMAL_PROPS[name]))
      );
      let componentFailed = false;
      for (const violation of renderViolations) {
        console.error(`✗ ${name} (${distFile}) emitted console.error during SSR: ${violation}`);
        hasErrors = true;
        componentFailed = true;
      }
      if (!markup || markup.trim().length === 0) {
        console.error(`✗ ${name} (${distFile}) rendered empty markup`);
        hasErrors = true;
        continue;
      }
      if (!componentFailed) {
        renderedCount++;
      }
    } catch (error) {
      console.error(`✗ ${name} (${distFile}) threw during SSR: ${error.stack ?? error.message}`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  process.exit(1);
}

if (renderedCount === 0) {
  console.error("✗ No components were rendered — check discovery logic");
  process.exit(1);
}

console.log(
  `✓ SSR check passed — ${renderedCount} components rendered against dist/ with no errors and no console.error output`
);
process.exit(0);
