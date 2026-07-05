# fluidkit

[![CI](https://github.com/runvendo/fluidkit/actions/workflows/ci.yml/badge.svg)](https://github.com/runvendo/fluidkit/actions/workflows/ci.yml)

A React library of liquid UI animations built on one idea: **one liquid engine, swappable materials.** Shapes are real metaball geometry (computed bezier bridges applied as a live `clip-path`), motion is spring-driven with surface tension (drops connect on touch, stretch, and snap), and the same shape renders as clear glass or a flat fill via a `material` prop. Built on top of [Motion](https://motion.dev).

## The core principle

**Animate the surface, never the text.** Every morph separates a surface layer (the liquid shape, free to scale, stretch, or merge) from a content layer (text / controls, which only cross-fades, never scales). Text always stays crisp.

## Install

```bash
npm install fluidkit react react-dom motion
```

`react`, `react-dom`, and `motion` are peer dependencies (bring your own shared copy).

### Optional GPU tier

`LiquidMetal` is a real WebGL primitive. It lives behind its own subpath export (`fluidkit/liquid-metal`), not the core `fluidkit` entry, so the core bundle stays GPU-free whether or not you use it. Its GPU library is an optional peer dependency: installing fluidkit without it never warns, and importing the core entry never resolves it.

```bash
npm i @paper-design/shaders-react@0.0.76   # for fluidkit/liquid-metal (pinned exact)
```

```tsx
import { LiquidMetal } from "fluidkit/liquid-metal";
```

See [`docs/primitives/liquid-metal.md`](docs/primitives/liquid-metal.md) for props, fallback behavior, and caveats.

## Quick start

```tsx
import { useState } from "react";
import { MorphSurface } from "fluidkit";

function App() {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen((v) => !v)}>
      <MorphSurface
        open={open}
        closedContent={<span>Ask fluidkit</span>}
        openContent={<div>Ready when you are.</div>}
      />
    </div>
  );
}
```

## Primitives

| Primitive | What it does | Degrades to |
|---|---|---|
| [`MorphSurface`](docs/primitives/morph-surface.md) | One liquid body: pill morphs into panel, satellite droplets absorbed through real bridges | Instant snap + opacity-only face fade |
| [`Droplets`](docs/primitives/droplets.md) | Drop cluster with surface tension; grab / drag / tear / re-merge with the pointer (`interactive`) | Separate static dots |
| [`Thinking`](docs/primitives/thinking.md) | Working indicator: droplets merge and split (`role="status"`) | Three static dots |
| [`FlowStagger`](docs/primitives/flow-stagger.md) | Staggered rise + un-blur entrance for list items, FLIP on reorder | Simple simultaneous fade |
| [`LiquidTabs`](docs/primitives/liquid-tabs.md) | Flagship tab strip: the indicator flows between tabs (slide or stretch), flat or glass material, labels tint by liquid coverage | Plain pill, snaps instantly |
| [`Ripple`](docs/primitives/ripple.md) | Pointer-origin water ripple on tap/click | No ripple, children render normally |
| [`LiquidButton`](docs/primitives/liquid-button.md) | Liquid pill button; jelly variant squashes on press via geometry (label never scales), still variant holds rigid | Normal button with an opacity press dip |
| [`MeshGradient`](docs/primitives/mesh-gradient.md) | Ambient CSS backdrop: large blurred radial-gradient blobs drift slowly behind your content | Static blobs at their home position |
| [`Silk`](docs/primitives/silk.md) | Ambient CSS backdrop: full-height diagonal gradient sheets flowing like slow fabric | Static sheets at their home position |
| [`GlassPanes`](docs/primitives/glass-panes.md) | Glass-native backdrop: edge-to-edge frosted panes sliding on a shared diagonal, each at its own blur depth | Layered frosted fills |
| [`Caustics`](docs/primitives/caustics.md) | Poolside light background, or a caustic wall material for engine surfaces | Static plaster wall when WebGL or motion is unavailable |
| [`LiquidCard`](docs/primitives/liquid-card.md) | Content surface that sizes to its children; the liquid layer stays behind crisp content | Static card; glass falls back to frosted flat fill |
| [`MeniscusDivider`](docs/primitives/meniscus-divider.md) | Thin full-width liquid bead for section breaks, exposed as a separator | Static separator; glass falls back to frosted flat fill |
| [`LiquidPanel`](docs/primitives/liquid-panel.md) | Drawer or sheet surface that pours in from one edge; content arrives above it | Surface snaps; content cross-fades |
| [`LiquidTooltip`](docs/primitives/liquid-tooltip.md) | Tooltip droplet that condenses beside its trigger, with focus and Escape behavior | Full-size droplet fade |
| [`LiquidText`](docs/primitives/liquid-text.md) | Glass or flat glyphs with a sheen sweep while the real text stays selectable | Solid readable text; sheen parks under reduced motion |
| [`LiquidDialog`](docs/primitives/liquid-dialog.md) | Modal surface that rises from its trigger with focus restore, scroll lock, Escape and backdrop close | No travel; surface and content cross-fade |
| [`VoiceBall`](docs/primitives/voice-ball.md) | Voice-assistant orb driven by `level` and `mode` (`idle`, `listening`, `speaking`) | Static circle reflecting the current level |
| [`LiquidSwitch`](docs/primitives/liquid-switch.md) | Toggle: the thumb droplet tears off one well through a real bridge and merges into the other; real hidden checkbox underneath | Thumb snaps; the on-tint still flips |
| [`LiquidCheckbox`](docs/primitives/liquid-checkbox.md) | The check is liquid: a droplet lands and fills the well; `indeterminate` is a half-filled meniscus | Fill level snaps |
| [`LiquidSlider`](docs/primitives/liquid-slider.md) | Droplet thumb riding the meniscus edge of a part-filled channel; real hidden range input underneath | Thumb tracks the value, no spring lag |
| [`LiquidField`](docs/primitives/liquid-field.md) | Text field on a glass surface: the input stays real and crisp, focus swells the surface + shows the focus meniscus | Swell dropped; focus ring stays |
| [`LiquidProgress`](docs/primitives/liquid-progress.md) | Determinate progress as a vessel filling; the meniscus wobbles only while the value moves | Fill width tracks the value |
| [`LiquidToast`](docs/primitives/liquid-toast.md) | `toast()` notifications that condense at the screen corner and evaporate on dismiss | Opacity-only in/out |
| [`LiquidMenu`](docs/primitives/liquid-menu.md) | Dropdown that pours from its trigger; full ARIA menu keyboard pattern | Opacity fade over poured geometry |
| [`LiquidMetal`](docs/primitives/liquid-metal.md) | Optional GPU tier: a real WebGL liquid-metal shader (`fluidkit/liquid-metal`) | Static metallic-gradient fallback |

### Materials

Every surface component shares one styling pack, applied wherever it's physically meaningful: `material` (`"glass"`/`"flat"`, with `material="caustics"` available on engine surfaces), `tint`/`color` (the glass tint, caustic light, or flat fill), `opacity` (how see-through the fill is, `0` clear to `1` solid; replaces the tint's own alpha, degrades to the default transparency where CSS relative color syntax is unsupported), `intensity` (how loudly the material reads, `0`-`1` or `"whisper"`/`"present"`), `light` (scene light position; `null` disables speculars), `reflection` (specular highlights on/off), `refraction` (opt-in Chromium-only edge lensing), and `shadow` (drop shadow on/off). Components omit only what can't physically apply: `LiquidText`'s lighting is its sheen sweep, not the scene light, so it takes none of `light`/`reflection`/`refraction`/`shadow`.

- `glass` — white tint + backdrop blur/saturation, specular highlights from one configurable scene light (`light` prop), toggleable via `reflection`. Opt-in `refraction` adds Chromium-only edge lensing (SVG displacement inside `backdrop-filter`; degrades silently). A drop of water is liquid glass.
- `flat` — plain color; also the automatic fallback when `backdrop-filter` is unsupported.
- `caustics` — poolside light over a plaster wall on supported engine surfaces. The wall is the no-WebGL fallback; caustic surfaces paint no glass speculars because the light pattern is the highlight.

### Theming

`FluidThemeProvider` turns a brand into coherent surfaces: semantic tokens in, per-component styling out.

```tsx
import { FluidThemeProvider } from "fluidkit";

<FluidThemeProvider theme={{ accent: "#0A7CFF", surface: "#FFF", text: "#14151A", radius: 14, mode: "light" }}>
  <App /> {/* every fluidkit surface inside derives its tint/fill/radius */}
</FluidThemeProvider>
```

- **Tokens**: `accent`, `surface`, `text`, `radius` (px), `mode` (`"light"`/`"dark"`), plus the character knobs `material` (`"glass"`/`"flat"`) and `intensity`. `mutedText`, `background`, and `fontFamily` are accepted but reserved (no component consumes them yet).
- **Derivation, not broadcast.** Each component reads the theme through its own rule (`src/theme/derive.ts`): containers tint from `accent` at a per-component share and fill flat from `surface`; ink surfaces (the tabs indicator, buttons, ripples) fill from `accent`; `LiquidText` glyphs fill from `text`; `radius` applies where a component has a radius prop. Dark `mode` raises tint alphas so glass reads over dark hosts.
- **Only set tokens derive.** An absent token never overrides a component default, so a colors-only theme keeps each component's character (tabs stay flat, buttons stay `present`). No provider = exactly the unthemed rendering.
- **Precedence**: explicit props → theme derivation → component defaults. Nested providers merge token-by-token, inner wins.
- `material="caustics"` is deliberately not themeable — it's ambient art, not a brand surface.

## Cross-cutting guarantees

- **Reduced motion**: `prefers-reduced-motion` collapses every effect to a clean static state; animation loops never run.
- **SSR-safe**: nothing touches `window` at import time or during render.
- **Tree-shakeable**: named exports from a single entry point (`sideEffects: false`).
- **Theming**: colors, tint, light position, and physics via props. No brand shipped.
- **Graceful degradation**: feature detection picks the best available path; never hard-fails.
- **Performance**: animation loops pause off-screen (IntersectionObserver) and under reduced motion.

## Motion accessibility & degradation

Every exported component ships with a tested degradation contract (`tests/degradation/`, one contract file per component). What you're guaranteed:

- **Reduced motion.** With `prefers-reduced-motion` on, a component still renders its content and stays interactive — buttons click, tabs switch, tooltips show on focus, dialogs open and close. No animation loop runs and no frame rewrites geometry; each primitive parks in its documented static state (the "Degrades to" column above). Opacity-only cross-fades are the one kind of motion that remains. When the preference is unknown (e.g. SSR), components default to the static-safe rendering.
- **Missing capability.** Where a component leans on a browser capability, the fallback is a real rendering, never a blank box: without `backdrop-filter`, glass degrades to a frosted flat fill (`GlassPanes`/`Silk` to layered tinted sheets); without WebGL, `Caustics` renders just its plaster wall and `LiquidMetal` a static metallic gradient; `refraction` is opt-in and silently skipped where SVG-filter backdrops aren't supported.

Consumers don't need to keep their own static fallbacks on top: if fluidkit renders it moving, it also renders it still.

## Release status

- **0.5.0**: current package. Ships semantic theming, tested degradation contracts, React 19 CI coverage, controls, menus, toasts, and the optional `LiquidMetal` subpath.
- **0.4.0**: added the surface family (`LiquidCard`, `LiquidPanel`, `LiquidDialog`, `LiquidTooltip`, `LiquidText`, `VoiceBall`, `MeniscusDivider`), ambient backgrounds, `Caustics`, and the docs showcase.
- **0.3.0**: moved `LiquidTabs` onto the engine, added pointer grab / tear / re-merge interactions, opt-in refraction, per-frame DOM writes, and the docs site.
- **0.2.0**: introduced the liquid engine and rebuilt `Droplets`, `Thinking`, and `MorphSurface` on it.

See [`CHANGELOG.md`](CHANGELOG.md) for full release notes.

## Docs site

The playground doubles as the public docs site: hero, live demos, controls, and copy-paste snippets for every primitive.

- Develop: `npm run dev`
- Build: `npm run build:site` → static bundle in `dist-site/`, deployable to any static host (GitHub Pages, Netlify, Vercel — no server needed).

## More

- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)

## Development

- `npm test`: run tests
- `npm run typecheck`: type check the library
- `npm run size`: check bundle size (36.7 kB brotli budget on the core entry via size-limit)
- `npm run check:gpu-leak`: guard against GPU dependencies
- `npm run check:pack`: verify npm pack contents

All guards run in CI (Node 20 and 24).

## License

MIT
