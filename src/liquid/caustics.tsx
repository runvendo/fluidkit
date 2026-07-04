/**
 * CausticsLayer — the liquid engine's caustic "poolside light".
 *
 * A transparent WebGL canvas that draws ONLY the light: webbed caustic
 * filaments, warm by default, drifting slowly inside a soft diagonal
 * sunbeam band. Whatever CSS paints beneath the layer (the material
 * `fillStyle`, a background component's base div) is the wall — and is
 * also the entire no-WebGL / SSR fallback, so the layer never needs one.
 *
 * The shader is an ORIGINAL construction (fluidkit): three drifting
 * plane-wave fields, domain-warped, with the light web extracted as the
 * ridge (zero-contour) of their sum. Do not replace it with Shadertoy
 * code — the well-known caustic shaders are CC BY-NC-SA and cannot ship
 * under MIT.
 *
 * Lifecycle: GL boots in an effect (never during render/SSR), resolution
 * tracks the host via ResizeObserver when available (sized once when
 * not), the rAF loop runs only while in view, reduced motion renders a
 * single still frame, context loss rebuilds the pipeline on restore (the
 * CSS base shows meanwhile), and unmount releases the context via
 * WEBGL_lose_context. Every failure path also releases the context —
 * browsers cap live WebGL contexts, so a failed boot must not hold one.
 */

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supportsWebGL } from "../utils/supportsWebGL";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface CausticsLayerProps {
  /** Light color (any CSS color). Defaults to warm ivory. */
  light?: string;
  /** Brightness of the light webs, 0-1. Defaults to 0.5. */
  intensity?: number;
  /** Size of the light pattern; higher = larger webs. Defaults to 1. */
  scale?: number;
  /** Drift rate; 1 is the quiet default rate. */
  speed?: number;
  /** Strength of the diagonal sunbeam, 0-1 (0 = uniform light). Defaults to 0.55. */
  band?: number;
}

export const CAUSTICS_DEFAULT_LIGHT = "#ffefd6";

const MAX_DPR = 1.5;
/** Fixed phase for the reduced-motion still frame (a pleasant, dense frame). */
const STILL_TIME = 7.0;

const VERT_SRC = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

/**
 * highp where the device offers it (uTime is unbounded — mediump's 10-bit
 * mantissa turns long-running time into visible stepping); mediump is the
 * WebGL1-guaranteed fallback for old GPUs.
 */
const FRAG_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uLight;
uniform float uIntensity;
uniform float uScale;
uniform float uBand;

vec2 warp(vec2 p, float t) {
  return p + 0.55 * vec2(
    sin(p.y * 1.35 + t * 0.40) + 0.6 * sin(p.x * 0.61 - t * 0.23),
    sin(p.x * 1.27 - t * 0.31) + 0.6 * sin(p.y * 0.83 + t * 0.17)
  );
}

float web(vec2 p, float t) {
  vec2 q = warp(p, t);
  float f = sin(dot(q, vec2(0.98, 0.21)) * 2.10 + t * 0.70)
          + sin(dot(q, vec2(-0.45, 0.89)) * 1.71 - t * 0.53)
          + sin(dot(q, vec2(0.37, -0.93)) * 2.63 + t * 0.31);
  float ridge = 1.0 - abs(f) * 0.40;
  return pow(clamp(ridge, 0.0, 1.0), 2.6);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * (6.0 / uScale);
  float g = web(p, uTime) + 0.5 * web(p * 1.9 + 3.7, uTime * 1.3);
  float d = uv.x + (1.0 - uv.y) * 0.6;
  float beam = smoothstep(0.10, 0.55, d) * (1.0 - smoothstep(0.9, 1.9, d));
  float glow = g * g * uIntensity * 0.9 * mix(1.0, 0.45 + 0.55 * beam, uBand);
  gl_FragColor = vec4(uLight, clamp(glow, 0.0, 1.0));
}
`;

/** CSS color → [r,g,b] 0-1 via a 2d-canvas round trip (cached per string). */
const colorCache = new Map<string, [number, number, number]>();
function parseColor(css: string): [number, number, number] {
  const cached = colorCache.get(css);
  if (cached) return cached;
  let rgb: [number, number, number] = [1, 0.937, 0.839]; // ivory fallback
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      rgb = [r / 255, g / 255, b / 255];
    }
  } catch {
    /* keep fallback */
  }
  colorCache.set(css, rgb);
  return rgb;
}

interface Pipeline {
  uRes: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uLight: WebGLUniformLocation | null;
  uIntensity: WebGLUniformLocation | null;
  uScale: WebGLUniformLocation | null;
  uBand: WebGLUniformLocation | null;
}

interface GlState {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  pipe: Pipeline;
  fit: () => void;
  ro: ResizeObserver | null;
  raf: number | null;
  t0: number;
  dead: boolean;
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Compile + link the program and bind the fullscreen triangle. Returns the
 * uniform locations, or null on any failure (created resources deleted).
 * Called at boot AND again after a context restore — a restored context
 * keeps nothing, so the whole pipeline must be rebuilt.
 */
function createPipeline(gl: WebGLRenderingContext): Pipeline | null {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    if (prog) gl.deleteProgram(prog);
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return {
    uRes: gl.getUniformLocation(prog, "uRes"),
    uTime: gl.getUniformLocation(prog, "uTime"),
    uLight: gl.getUniformLocation(prog, "uLight"),
    uIntensity: gl.getUniformLocation(prog, "uIntensity"),
    uScale: gl.getUniformLocation(prog, "uScale"),
    uBand: gl.getUniformLocation(prog, "uBand"),
  };
}

function releaseContext(gl: WebGLRenderingContext): void {
  try {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* already lost */
  }
}

const hostStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

export function CausticsLayer({
  light = CAUSTICS_DEFAULT_LIGHT,
  intensity = 0.5,
  scale = 1,
  speed = 1,
  band = 0.55,
}: CausticsLayerProps) {
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const stateRef = useRef<GlState | null>(null);
  // Live params, readable from the render loop without re-booting GL.
  const paramsRef = useRef({ light, intensity, scale, speed, band });
  paramsRef.current = { light, intensity, scale, speed, band };
  // The draw effect's current "start drawing" entry point; a context
  // restore re-invokes it so the loop (or still frame) resumes.
  const startRef = useRef<(() => void) | null>(null);

  // useInView's ref is a callback; merge it with our own node capture so
  // the boot effect re-runs when the host actually exists.
  const hostRef = useCallback(
    (node: HTMLDivElement | null) => {
      inViewRef(node);
      setHost(node);
    },
    [inViewRef]
  );

  // Boot per host node. All failure paths release the context and leave
  // the host empty — the CSS beneath the layer is the design's fallback.
  useEffect(() => {
    if (!host || !supportsWebGL()) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block";
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return;

    const pipe = createPipeline(gl);
    if (!pipe) {
      // Don't hold one of the page's few WebGL context slots for a canvas
      // that will never draw.
      releaseContext(gl);
      return;
    }

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const state: GlState = {
      canvas,
      gl,
      pipe,
      fit,
      ro: null,
      raf: null,
      t0: performance.now(),
      dead: false,
    };
    // ResizeObserver is near-universal but NOT implied by WebGL support
    // (older embedded WebViews); without it, size once and stay put.
    if (typeof ResizeObserver !== "undefined") {
      state.ro = new ResizeObserver(fit);
      state.ro.observe(host);
    }
    fit();

    const onLost = (e: Event) => {
      // preventDefault signals we want webglcontextrestored.
      e.preventDefault();
      state.dead = true;
      if (state.raf !== null) cancelAnimationFrame(state.raf);
      state.raf = null;
    };
    const onRestored = () => {
      // A restored context keeps NO resources — rebuild everything.
      const rebuilt = createPipeline(gl);
      if (!rebuilt) {
        releaseContext(gl);
        canvas.remove();
        return;
      }
      state.pipe = rebuilt;
      state.dead = false;
      fit();
      startRef.current?.();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    host.appendChild(canvas);
    stateRef.current = state;

    return () => {
      state.dead = true;
      if (state.raf !== null) cancelAnimationFrame(state.raf);
      state.ro?.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      releaseContext(gl);
      canvas.remove();
      stateRef.current = null;
    };
  }, [host]);

  // Draw: loop while animating; a single still frame otherwise.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;

    const frame = (timeSeconds: number) => {
      if (state.dead) return;
      const { gl, pipe } = state;
      const p = paramsRef.current;
      const [r, g, b] = parseColor(p.light);
      gl.uniform2f(pipe.uRes, state.canvas.width, state.canvas.height);
      gl.uniform1f(pipe.uTime, timeSeconds);
      gl.uniform3f(pipe.uLight, r, g, b);
      gl.uniform1f(pipe.uIntensity, p.intensity);
      gl.uniform1f(pipe.uScale, Math.max(p.scale, 0.05));
      gl.uniform1f(pipe.uBand, p.band);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const animating = inView && !reduced;
    const start = () => {
      if (!animating) {
        // Still frame (reduced motion, or offscreen with fresh props).
        frame(STILL_TIME);
        return;
      }
      const loop = (now: number) => {
        frame(((now - state.t0) / 1000) * paramsRef.current.speed);
        state.raf = requestAnimationFrame(loop);
      };
      state.raf = requestAnimationFrame(loop);
    };
    startRef.current = start;
    start();

    return () => {
      startRef.current = null;
      if (state.raf !== null) cancelAnimationFrame(state.raf);
      state.raf = null;
    };
  }, [host, inView, reduced, light, intensity, scale, speed, band]);

  return (
    <div
      ref={hostRef}
      data-fluidkit="caustics-layer"
      data-animating={inView && !reduced}
      aria-hidden="true"
      style={hostStyle}
    />
  );
}
