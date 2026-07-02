# fluidkit redesign: liquid engine + materials

Status: approved direction (validated live in `prototypes/07-liquid-glass-lab.html`).
Supersedes the goo-filter approach from BRIEF.md. Everything else in BRIEF.md
(Motion foundation, React surface, a11y, SSR, tree-shaking, "never animate text")
still holds.

## Why rebuild?

- The v0.1 primitives don't reach the Apple-level bar. Root causes:
  - Goo filter (blur + contrast) -> melty, matte, 2013-CSS-tricks look. Gooey is not liquid.
  - No material: flat fills, no light behavior.
  - Floppy physics: random wobble, slow settle. Real liquid is taut.
- The goo filter is also a technical dead end: it only works on opaque flat
  colors. It can never render clear glass. -> **kill it entirely.**

## The core idea

**One liquid engine, swappable materials.** Glass and mercury are the same
liquid; only the material differs. A drop of water IS liquid glass.

- **Engine (shape + physics):** computed metaball geometry. Circle and
  rounded-rect subpaths plus bezier bridge curves, applied per frame as a live
  `clip-path` on the material layer. Spring-driven positions (fast settle,
  near-critically damped, subtle overshoot allowed).
- **Surface tension via hysteresis:** two bodies connect only when they
  actually touch (neck starts at a minimum width, never a hairline). Once
  connected they stretch until ~1.3x combined radii, then snap. Neck waist
  never drops below ~60% of base. -> connect on touch, snap on stretch.
- **Materials (render layer), a prop not a component family:**
  - `glass`: white tint + `backdrop-filter: blur + saturate`. Specular
    highlights from ONE configurable light source per scene (`light` prop);
    each body's highlight sits on the side facing the light, tangent to the
    surface. Soft shadow on a separate layer.
  - `mercury`: metallic gradient fill, **no painted highlight** (the gradient
    is the reflection).
  - `flat`: plain color, for subtle UI uses and as the reduced fallback.

## The one non-negotiable (unchanged)

**Animate the surface, never the text.** Content lives on an unfiltered
overlay layer and only cross-fades or translates a few px. The clip-path
engine makes this natural: the material layer is clipped, content is a
sibling.

## Component mapping

| Old (v0.1) | New | Notes |
|---|---|---|
| `Metaballs` (goo) | `Droplets` | engine drops, `material` prop, optional pointer-follow drop |
| `ThinkingBlob` (goo) | `Thinking` | merge/split droplet cycle on the engine |
| `MorphSurface` | `MorphSurface` | pill -> panel via engine roundrect; optional satellite absorb beat |
| `LiquidGlass` | `material="glass"` | stops being a separate wrapper of `@samasante/liquid-glass`; drop that dep |
| `LiquidTabs` | keep, retune | taut springs; indicator can use engine stretch later |
| `FlowStagger`, `Ripple` | keep, retune | springs to taut presets; not engine-based |

## How this fits the "built on Motion" decision

Motion stays the peer dependency and drives all values (springs, layout,
presence). The engine consumes spring-driven motion values and recomputes the
clip path per frame from them. We do not ship a second physics library; the
lab's tiny integrator gets replaced by Motion springs with equivalent tuning.

## Rendering constraints (hard-won in the lab, encode as tests/docs)

- `clip-path` and `backdrop-filter` must NOT sit on the same element
  (Chromium artifact). -> clip on a wrapper, material fill on a child.
- Never use CSS `blur()` for soft glows/highlights on SVG or decorative
  blobs: the rectangular filter region clips into visible straight seams,
  amplified by backdrop saturation. -> radial gradients only.
- Inline `<svg>` overlays need explicit width/height (intrinsic 300x150
  silently clips content).
- Glass must not backdrop-sample its own shadow -> shadow is a light, offset,
  shrunken layer; demo/default scenes are light mode.

## Cross-cutting (unchanged from BRIEF.md)

- `prefers-reduced-motion`: collapse to fade/static. Droplets -> static dots,
  morph -> instant swap + fade.
- Theming-agnostic: colors, tint, light position, tension, spring params via
  props / CSS custom properties.
- SSR-safe, tree-shakeable, feature-detect `backdrop-filter` (fallback:
  `flat` material).
- Pause off-screen (IntersectionObserver); one rAF loop per scene, not per
  drop.

## Milestones

- **v0.2 (engine core):** liquid engine (paths, bridges, hysteresis, light),
  `glass` + `mercury` + `flat` materials, `Droplets`, `Thinking`,
  `MorphSurface` rebuilt. Playground rebuilt light-mode-first around them.
- **v0.3:** `LiquidTabs` on the engine, pointer interactions
  (drag-merge-snap), docs site.
- Old goo code and `@samasante/liquid-glass` dep deleted in v0.2.

## Open questions (fine to resolve during planning)

- Exact public API shape for the engine (hook `useLiquid()` vs internal only).
- Whether `MorphSurface` keeps a Motion `layoutId` mode for cross-DOM morphs
  alongside the engine mode.
