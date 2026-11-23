import { Link } from "react-router-dom";
import { CountUp } from "../components/fx";
import { PROJECTS } from "../data/projects";
import { ROADMAP, nodeById } from "../data/roadmap";
import { useAuth } from "../lib/auth";
import { levelOf, useProgress } from "../lib/progress";
import { openProjects, recommendNext } from "../lib/recommend";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default function Home() {
  const { user } = useAuth();
  const { s, nodeUnlocked, nodeDone, dailyMinutes } = useProgress();
  const next = recommendNext(s, nodeUnlocked);
  const alternatives = next ? openProjects(s, nodeUnlocked).filter((p) => p.id !== next.project.id).slice(0, 2) : [];
  const doneCount = Object.keys(s.completed).length;
  const goal = s.profile?.dailyMinutes ?? 20;
  const dailyPct = Math.min(100, Math.round((dailyMinutes / goal) * 100));
  const first = user?.display_name.split(" ")[0] ?? "";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* level 1: who + where you are, kept small so it never competes with the action */}
      <header className="animate-rise">
        <p className="muted text-sm">{greeting()}, {first}</p>
        <h1 className="mt-0.5 text-3xl font-extrabold sm:text-4xl">
          {doneCount === 0 ? <>Let's build your <span className="text-gradient">first project</span></> : s.streak > 1 ? <>{s.streak} days in. <span className="text-gradient">Keep going.</span></> : <>Pick up <span className="text-gradient">where you left off</span></>}
        </h1>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* level 2: THE one thing to do next (the only element with a glowing gradient border) */}
        {next ? (
          <section className="hero-card animate-rise" style={{ animationDelay: "80ms" }}>
            <p className="text-sm font-semibold text-primary">{doneCount === 0 ? "Start here" : s.drafts[next.project.id] ? "Continue" : "Up next"}</p>
            <h2 className="mt-1 text-3xl font-extrabold">{next.project.title}</h2>
            <p className="mt-2 max-w-lg text-lg leading-snug">{next.project.goal}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="chip">⏱ ~{next.project.minutes} min</span>
              <span className="chip">{["Easy", "Medium", "Challenging"][next.project.difficulty - 1]}</span>
              <span className="chip chip-primary">{nodeById(next.project.nodeId).title}</span>
            </div>
            <p className="muted mt-3 text-sm">💡 {next.reason}</p>
            <Link to={`/project/${next.project.id}`} className="btn btn-primary btn-lg mt-6">{s.drafts[next.project.id] ? "Continue project" : "Start project"} →</Link>

            {alternatives.length > 0 && (
              <p className="muted mt-5 border-t border-line pt-4 text-sm">
                Not feeling it? Try instead:{" "}
                {alternatives.map((p, i) => (
                  <span key={p.id}>{i > 0 && " · "}<Link to={`/project/${p.id}`} className="font-semibold text-primary hover:underline">{p.title}</Link></span>
                ))}
              </p>
            )}
          </section>
        ) : (
          <section className="hero-card">
            <h2 className="text-2xl font-extrabold">🎉 You've finished every available project</h2>
            <p className="muted mt-1">More tracks are coming. See what you've built.</p>
            <Link to="/portfolio" className="btn btn-primary mt-4">View portfolio</Link>
          </section>
        )}

        {/* level 3: supporting numbers, quieter, one card */}
        <aside className="card animate-rise self-start" style={{ animationDelay: "160ms" }} aria-label="Today">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Today</h2>
            <span className="chip">{dailyMinutes}/{goal} min</span>
          </div>
          <div className="bar mt-3"><span style={{ width: `${dailyPct}%` }} /></div>
          <p className="muted mt-2 text-xs">{dailyPct >= 100 ? "Daily goal reached 🎯" : `${Math.max(goal - dailyMinutes, 0)} min to reach today's goal`}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div><dt className="muted text-[10px] font-semibold uppercase tracking-wider">Level</dt><dd className="text-2xl font-extrabold"><CountUp value={levelOf(s.xp)} /></dd></div>
            <div><dt className="muted text-[10px] font-semibold uppercase tracking-wider">Streak</dt><dd className="text-2xl font-extrabold"><span aria-hidden>🔥</span><CountUp value={s.streak} /></dd></div>
            <div><dt className="muted text-[10px] font-semibold uppercase tracking-wider">Built</dt><dd className="text-2xl font-extrabold"><CountUp value={doneCount} /><span className="muted text-sm">/{PROJECTS.length}</span></dd></div>
          </dl>
          <p className="muted mt-3 text-[11px]">{s.freezes} streak freeze{s.freezes === 1 ? "" : "s"} saved: a missed day won't break your streak.</p>
        </aside>
      </div>

      {/* level 4: the path as a compact rail instead of a stack of cards */}
      <section className="mt-10 animate-rise" style={{ animationDelay: "240ms" }}>
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-bold">Your path</h2>
          <Link to="/roadmap" className="text-sm font-semibold text-primary hover:underline">Customize roadmap →</Link>
        </div>
        <ol className="mt-4 flex items-start gap-1 overflow-x-auto pb-2">
          {ROADMAP.map((n, i) => {
            const done = nodeDone(n.id);
            const open = nodeUnlocked(n.id);
            const focus = s.focus === n.id;
            return (
              <li key={n.id} className="flex min-w-[96px] flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done || open ? "bg-primary" : "bg-line"}`} />
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-success text-white" : open ? "bg-primary text-white animate-ring" : "bg-surface2 text-muted"}`}>
                    {done ? "✓" : n.comingSoon ? "…" : i + 1}
                  </span>
                  <span className={`h-0.5 flex-1 ${i === ROADMAP.length - 1 ? "opacity-0" : done ? "bg-primary" : "bg-line"}`} />
                </div>
                <p className={`mt-2 text-xs font-semibold leading-tight ${open || done ? "" : "muted"}`}>{focus && "⭐ "}{n.title}</p>
                <p className="muted text-[10px]">{done ? (s.skipped.includes(n.id) ? "skipped" : "done") : n.comingSoon ? "soon" : open ? "open" : "locked"}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
