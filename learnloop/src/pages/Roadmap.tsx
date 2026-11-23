import { useMemo, useState } from "react";
import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Link } from "react-router-dom";
import { PROJECTS } from "../data/projects";
import { ROADMAP } from "../data/roadmap";
import { useProgress } from "../lib/progress";

type Status = "done" | "open" | "locked" | "soon";
type Data = { title: string; status: Status; progress: string; selected: boolean; focus: boolean; skipped: boolean };

const STYLE: Record<Status, string> = {
  done: "border-success bg-success-soft text-fg",
  open: "border-primary bg-surface text-fg shadow-lg",
  locked: "border-line bg-surface2 text-muted",
  soon: "border-dashed border-line bg-surface2 text-muted",
};
const ICON: Record<Status, string> = { done: "✅", open: "▶️", locked: "🔒", soon: "🕒" };

function TopicNode({ data }: NodeProps<Node<Data>>) {
  return (
    <div className={`w-44 cursor-pointer rounded-xl border-2 px-3 py-2 transition ${STYLE[data.status]} ${data.selected ? "ring-4 ring-primary/30" : ""}`}>
      <Handle type="target" position={Position.Left} className="!bg-muted" />
      <div className="text-sm font-bold">{data.focus ? "⭐ " : ICON[data.status] + " "}{data.title}</div>
      <div className="text-xs opacity-70">{data.progress}</div>
      <Handle type="source" position={Position.Right} className="!bg-muted" />
    </div>
  );
}

const POS: Record<string, { x: number; y: number }> = {
  html: { x: 0, y: 95 }, css: { x: 225, y: 10 }, js: { x: 225, y: 180 },
  layout: { x: 450, y: 10 }, dom: { x: 450, y: 180 }, react: { x: 675, y: 95 },
};
const nodeTypes = { topic: TopicNode };

export default function Roadmap() {
  const { s, nodeDone, nodeUnlocked, toggleSkip, setFocus } = useProgress();
  const [sel, setSel] = useState("html");

  const { nodes, edges } = useMemo(() => {
    const nodes: Node<Data>[] = ROADMAP.map((n) => {
      const ps = PROJECTS.filter((p) => p.nodeId === n.id);
      const done = ps.filter((p) => s.completed[p.id]).length;
      const status: Status = n.comingSoon ? "soon" : nodeDone(n.id) ? "done" : nodeUnlocked(n.id) ? "open" : "locked";
      return {
        id: n.id, type: "topic", position: POS[n.id], draggable: false,
        data: { title: n.title, status, selected: sel === n.id, focus: s.focus === n.id, skipped: s.skipped.includes(n.id), progress: n.comingSoon ? "Coming soon" : s.skipped.includes(n.id) ? "Skipped (you know this)" : `${done}/${ps.length} projects` },
      };
    });
    const edges: Edge[] = ROADMAP.flatMap((n) => n.requires.map((r) => ({ id: `${r}-${n.id}`, source: r, target: n.id, animated: nodeUnlocked(n.id) })));
    return { nodes, edges };
  }, [s, sel, nodeDone, nodeUnlocked]);

  const node = ROADMAP.find((n) => n.id === sel)!;
  const projects = PROJECTS.filter((p) => p.nodeId === sel);
  const open = nodeUnlocked(sel);
  const skipped = s.skipped.includes(sel);
  const done = nodeDone(sel);

  return (
    <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[1fr_360px]">
      <div className="lg:col-span-2 animate-rise">
        <h1 className="text-2xl font-extrabold">Your roadmap</h1>
        <p className="muted text-sm">We suggest the order, and you stay in control: skip what you know or pin a topic as your focus. Everything here is reversible.</p>
      </div>

      <div className="card h-[440px] !p-0 lg:h-[540px]">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.04, maxZoom: 1.3 }} minZoom={0.2} nodesConnectable={false} onNodeClick={(_, n) => setSel(n.id)} proOptions={{ hideAttribution: true }}>
          <Background gap={20} color="var(--line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <aside className="card animate-rise h-fit" aria-live="polite" key={sel}>
        <h2 className="text-xl font-extrabold">{node.title}</h2>
        <p className="mt-1">{node.summary}</p>
        <p className="muted mt-2 text-sm"><b className="text-fg">Why it matters:</b> {node.why}</p>

        {/* customization: kept in one quiet row so the topic's content stays the focus */}
        {!node.comingSoon && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => toggleSkip(sel)} title="Mark as already known. You can undo this any time.">
              {skipped ? "↩ Undo skip" : "⏭ I already know this"}
            </button>
            {open && !done && (
              <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setFocus(s.focus === sel ? null : sel)}>
                {s.focus === sel ? "★ Unpin focus" : "☆ Make this my focus"}
              </button>
            )}
          </div>
        )}

        <h3 className="mt-5 text-sm font-bold">Study material</h3>
        <ul className="mt-1.5 grid gap-1.5 text-sm">
          {node.resources.map((r) => (
            <li key={r.url}><a className="text-primary hover:underline" href={r.url} target="_blank" rel="noreferrer">↗ {r.title}</a></li>
          ))}
        </ul>

        <h3 className="mt-5 text-sm font-bold">Projects</h3>
        {node.comingSoon ? (
          <p className="muted mt-1 text-sm">Coming soon.</p>
        ) : !open && !done ? (
          <p className="muted mt-1 text-sm">🔒 Finish the earlier topics to unlock these, or skip them if you know them.</p>
        ) : (
          <ul className="mt-1.5 grid gap-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/project/${p.id}`} className="btn btn-ghost w-full justify-between">
                  <span>{s.completed[p.id] ? "✅" : "▶️"} {p.title}</span>
                  <span className="muted text-xs">~{p.minutes} min</span>
                </Link>
              </li>
            ))}
            {skipped && <li className="muted text-xs">You marked this as known. Projects stay available for practice.</li>}
          </ul>
        )}
      </aside>
    </main>
  );
}
