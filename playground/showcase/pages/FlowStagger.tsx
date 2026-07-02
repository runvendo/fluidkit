import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FlowStagger } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Snippet, VariantGrid, VariantCell, MountOnView } from "../kit";

const SEED_TASKS = ["Summarize spending", "Move $500 to savings", "Cancel duplicate sub"];

const ROW_STYLE: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e3ea",
  borderRadius: 12,
  padding: "10px 13px",
  fontSize: 13,
  boxShadow: "0 1px 2px rgba(24,25,36,.06)",
};

/** Independent task-list state: seed items plus Add (prepend) / Remove (shift). */
function useTaskList() {
  const [items, setItems] = useState(SEED_TASKS);
  const counter = useRef(0);
  const add = () => {
    counter.current += 1;
    const n = counter.current;
    setItems((x) => [`New task ${n}`, ...x]);
  };
  const remove = () => setItems((x) => x.slice(1));
  return { items, add, remove };
}

function TaskList({ items, stagger, width = 260 }: { items: string[]; stagger: number; width?: number }) {
  return (
    <FlowStagger
      // stagger only orchestrates on the container's mount entrance, so changing
      // it must remount to be visible — dragging the slider replays the entrance.
      key={stagger}
      stagger={stagger}
      style={{ display: "flex", flexDirection: "column", gap: 8, width }}
    >
      {items.map((t) => (
        <div key={t} style={ROW_STYLE}>
          {t}
        </div>
      ))}
    </FlowStagger>
  );
}

/** Variant cell body: its own list + its own Add/Remove so each stagger can be felt in isolation. */
function StaggerCellDemo({ stagger }: { stagger: number }) {
  const { items, add, remove } = useTaskList();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <TaskList items={items} stagger={stagger} width={200} />
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
  const { items, add, remove } = useTaskList();
  const [stagger, setStagger] = useState(0.06);

  return (
    <PageLayout
      title="FlowStagger"
      description="Children rise + un-blur, staggered; siblings glide on change. Every item carries Motion's layout, so adds, removes, and reorders FLIP the rest of the list into place."
      hero={
        <>
          <Stage hint="click Add / Remove">
            <TaskList items={items} stagger={stagger} />
          </Stage>
          <Controls>
            <Slider label="stagger" value={stagger} set={setStagger} min={0} max={0.2} step={0.01} suffix="s" />
            <button className="btn" onClick={add}>
              Add
            </button>
            <button className="btn" onClick={remove}>
              Remove
            </button>
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="tight · 0.02s">
            <MountOnView>
              <StaggerCellDemo stagger={0.02} />
            </MountOnView>
          </VariantCell>
          <VariantCell label="default · 0.06s">
            <MountOnView>
              <StaggerCellDemo stagger={0.06} />
            </MountOnView>
          </VariantCell>
          <VariantCell label="languid · 0.14s">
            <MountOnView>
              <StaggerCellDemo stagger={0.14} />
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
