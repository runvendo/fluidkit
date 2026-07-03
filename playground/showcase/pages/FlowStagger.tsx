import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FlowStagger } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Snippet, VariantGrid, VariantCell, MountOnView } from "../kit";

const SEED_TASKS = ["Summarize spending", "Move $500 to savings", "Cancel duplicate sub"];

/** Glass card: backdrop-blur over the pool gradient, specular top edge from
 * the single top-left light source. */
const ROW_STYLE: CSSProperties = {
  background: "rgba(255,255,255,0.52)",
  backdropFilter: "blur(10px) saturate(1.5)",
  WebkitBackdropFilter: "blur(10px) saturate(1.5)",
  border: "1px solid rgba(255,255,255,0.75)",
  borderRadius: 12,
  padding: "10px 13px",
  fontSize: 13,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.85), 0 2px 6px rgba(24,25,36,.08)",
  cursor: "pointer",
  userSelect: "none",
};

/** Row spacing lives INSIDE each item (padding, not container gap or margin
 * — both escape the exit collapse) so an exiting row's wrapper clips its
 * spacing as it submerges — no snap at unmount. */
const ROW_SPACER: CSSProperties = { paddingBottom: 8 };

/** One row + its spacer, for reserving vertical space (measured). */
const ROW_STEP = 48;

/** The stage centers its content, so an unwrapped pool re-centers on every
 * add/remove — everything shifts. Reserving the max-capacity height keeps
 * the centered box constant: the pool stays top-anchored and only grows
 * downward, so rows above a change never move. */
const poolReserve = (maxItems: number, padding: number) =>
  maxItems * ROW_STEP + padding * 2 - 16;

/** Soft light-mode pool the glass rows refract — lit from the top left. */
const POOL_STYLE: CSSProperties = {
  padding: 20,
  borderRadius: 16,
  background:
    "radial-gradient(120% 90% at 18% 0%, #dbe7ff 0%, rgba(219,231,255,0) 55%)," +
    "radial-gradient(110% 100% at 85% 100%, #ffe8d6 0%, rgba(255,232,214,0) 60%)," +
    "#f2f4fa",
};

/** Independent task-list state: seed items plus Add (prepend), Remove
 * (drop the top row — the reverse of Add), Shuffle, and move-to-top.
 * `max` keeps the list inside its fixed-height stage: when full, Add pushes
 * the bottom item out (it submerges as the new one rises in). */
function useTaskList(max: number) {
  const [items, setItems] = useState(SEED_TASKS);
  const counter = useRef(0);
  const add = () => {
    counter.current += 1;
    const n = counter.current;
    setItems((x) => [`New task ${n}`, ...x].slice(0, max));
  };
  // The exact reverse of add: the top row submerges, the rest glide back up.
  const remove = () => setItems((x) => x.slice(1));
  const shuffle = () =>
    setItems((x) => {
      const a = [...x];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  const moveToTop = (t: string) =>
    setItems((x) => [t, ...x.filter((i) => i !== t)]);
  return { items, add, remove, shuffle, moveToTop };
}

function TaskList({
  items,
  stagger,
  width = 260,
  padding = 20,
  maxItems,
  onRowClick,
}: {
  items: string[];
  stagger: number;
  width?: number;
  padding?: number;
  maxItems: number;
  onRowClick?: (t: string) => void;
}) {
  return (
    <div
      style={{
        height: poolReserve(maxItems, padding),
        display: "flex",
        alignItems: "flex-start",
      }}
    >
      <FlowStagger
        // stagger only orchestrates on the container's mount entrance, so changing
        // it must remount to be visible — dragging the slider replays the entrance.
        key={stagger}
        stagger={stagger}
        // Pool styling lives on FlowStagger itself: its container carries
        // Motion's layout, so the gradient grows/shrinks with the list.
        style={{ ...POOL_STYLE, width, padding, paddingBottom: padding - 8 }}
      >
        {items.map((t) => (
          <div key={t} style={ROW_SPACER}>
            <div style={ROW_STYLE} onClick={() => onRowClick?.(t)}>
              {t}
            </div>
          </div>
        ))}
      </FlowStagger>
    </div>
  );
}

/** Variant cell body: its own list + its own controls so each stagger can be felt in isolation. */
function StaggerCellDemo({ stagger }: { stagger: number }) {
  const { items, add, remove, moveToTop } = useTaskList(3);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <TaskList items={items} stagger={stagger} width={200} padding={12} maxItems={3} onRowClick={moveToTop} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={add}>
          Add
        </button>
        <button className="btn" onClick={remove}>
          Remove
        </button>
      </div>
    </div>
  );
}

export default function FlowStaggerPage() {
  const { items, add, remove, shuffle, moveToTop } = useTaskList(7);
  const [stagger, setStagger] = useState(0.02);

  return (
    <PageLayout
      title="FlowStagger"
      description="Children rise + un-blur in a viscous cascade; siblings glide on change, rippling outward from the point of disturbance. Removals submerge — sink, blur out — instead of switching off. Every item carries Motion's layout, so adds, removes, and reorders FLIP the rest of the list into place."
      hero={
        <>
          <Stage hint="Add / Remove / Shuffle — or click a row to send it to the top">
            <TaskList items={items} stagger={stagger} maxItems={7} onRowClick={moveToTop} />
          </Stage>
          <Controls>
            <Slider label="stagger" value={stagger} set={setStagger} min={0} max={0.1} step={0.01} suffix="s" />
            <button className="btn" onClick={add}>
              Add
            </button>
            <button className="btn" onClick={remove}>
              Remove
            </button>
            <button className="btn" onClick={shuffle}>
              Shuffle
            </button>
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="simultaneous · 0s">
            <MountOnView>
              <StaggerCellDemo stagger={0} />
            </MountOnView>
          </VariantCell>
          <VariantCell label="default · 0.02s">
            <MountOnView>
              <StaggerCellDemo stagger={0.02} />
            </MountOnView>
          </VariantCell>
          <VariantCell label="relaxed · 0.05s">
            <MountOnView>
              <StaggerCellDemo stagger={0.05} />
            </MountOnView>
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`import { FlowStagger } from "fluidkit";

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <FlowStagger stagger={${stagger}}>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </FlowStagger>
  );
}`}
        />
      }
    />
  );
}
