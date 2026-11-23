import { Link } from "react-router-dom";
import { projectById } from "../data/projects";
import { buildDoc } from "../lib/checks";
import { useProgress } from "../lib/progress";

export default function Portfolio() {
  const { s } = useProgress();
  const items = Object.entries(s.completed).sort((a, b) => b[1].at.localeCompare(a[1].at));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">Your portfolio</h1>
      <p className="muted mt-1">Everything you've built, running live.</p>
      {items.length === 0 ? (
        <div className="card animate-rise mt-6 text-center !py-12">
          <p className="text-4xl" aria-hidden>🧱</p>
          <p className="mt-3 text-lg font-bold">Nothing here yet</p>
          <p className="muted mt-1">Finish your first project and it appears here, ready to show off.</p>
          <Link to="/" className="btn btn-primary mt-5">Start a project</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([id, c], i) => {
            const p = projectById(id);
            return (
              <article key={id} className="card animate-rise overflow-hidden !p-0 transition hover:-translate-y-0.5" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="h-44 overflow-hidden border-b border-line bg-white">
                  <iframe title={`${p.title} preview`} sandbox="" srcDoc={buildDoc(c.code)} className="pointer-events-none h-[352px] w-[200%] origin-top-left scale-50 border-0" />
                </div>
                <div className="p-4">
                  <h2 className="font-bold">{p.title}</h2>
                  <p className="muted text-xs">{new Date(c.at).toLocaleDateString()} · +{c.xp} XP · {c.attempts} attempt{c.attempts === 1 ? "" : "s"}</p>
                  <Link to={`/project/${id}`} className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">Open →</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
