import { Link } from "react-router-dom";
import { goalTitle, weeksToFinish } from "../data/onboarding";
import { ROADMAP } from "../data/roadmap";
import { useAuth } from "../lib/auth";
import { useProgress } from "../lib/progress";
import { recommendNext } from "../lib/recommend";

/** The payoff of onboarding: a concrete, personal plan, so the first click has an obvious next step. */
export default function Plan() {
  const { user } = useAuth();
  const { s, nodeUnlocked, nodeDone } = useProgress();
  const p = s.profile;
  const next = recommendNext(s, nodeUnlocked);
  const weeks = weeksToFinish(p?.dailyMinutes ?? 20, s.skipped);
  const first = user?.display_name.split(" ")[0] ?? "there";
  const live = ROADMAP.filter((n) => !n.comingSoon);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="animate-rise">
        <p className="chip !bg-success-soft !text-success">✓ Your plan is ready</p>
        <h1 className="mt-3 text-4xl font-extrabold">Let's go, {first}.</h1>
        <p className="muted mt-2 text-lg">Here's what we built for you.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="card"><p className="muted text-xs font-semibold uppercase tracking-wide">Goal</p><p className="mt-1 font-bold leading-snug">{goalTitle(p?.goal ?? "curious")}</p></div>
          <div className="card"><p className="muted text-xs font-semibold uppercase tracking-wide">Daily pace</p><p className="mt-1 font-bold">{p?.dailyMinutes ?? 20} min</p></div>
          <div className="card"><p className="muted text-xs font-semibold uppercase tracking-wide">First track</p><p className="mt-1 font-bold">~{weeks} week{weeks === 1 ? "" : "s"}</p></div>
        </div>

        <h2 className="mt-8 text-lg font-bold">Your roadmap</h2>
        <ol className="mt-3 grid gap-2">
          {live.map((n, i) => {
            const done = nodeDone(n.id);
            const open = nodeUnlocked(n.id);
            return (
              <li key={n.id} className="card flex items-center gap-3 !py-3" style={{ animationDelay: `${i * 60}ms` }}>
                <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${done ? "bg-success-soft text-success" : open ? "bg-primary-soft text-primary" : "bg-surface2 text-muted"}`}>{done ? "✓" : i + 1}</span>
                <span className="font-semibold">{n.title}</span>
                <span className="muted ml-auto text-xs">{done ? "Already know it" : open ? "Start here" : "Unlocks later"}</span>
              </li>
            );
          })}
        </ol>

        {next && (
          <div className="card mt-8 !border-primary">
            <p className="text-sm font-semibold text-primary">Your first project</p>
            <h3 className="mt-1 text-xl font-extrabold">{next.project.title}</h3>
            <p className="mt-1">{next.project.goal}</p>
            <p className="muted mt-2 text-sm">⏱ ~{next.project.minutes} min</p>
            <Link to={`/project/${next.project.id}`} className="btn btn-primary btn-lg mt-4 w-full">Start building →</Link>
          </div>
        )}
        <Link to="/" className="muted mt-4 block text-center text-sm underline">Go to my dashboard</Link>
      </div>
    </main>
  );
}
