import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { css as cssLang } from "@codemirror/lang-css";
import { html as htmlLang } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import ChatDrawer from "../components/ChatDrawer";
import { Confetti, CountUp } from "../components/fx";
import { PROJECTS } from "../data/projects";
import { nodeById } from "../data/roadmap";
import { MODES, VARIANTS, type Mode } from "../data/variants";
import { getFeedback, type Feedback } from "../lib/ai";
import { ApiError } from "../lib/api";
import { buildDoc, runChecks, type CheckResult } from "../lib/checks";
import { useProgress, type Code } from "../lib/progress";
import { choiceFor, hasVariants, resolveProject } from "../lib/projectView";
import { recommendNext } from "../lib/recommend";

type Tab = "html" | "css" | "js";
const LANG = { html: [htmlLang()], css: [cssLang()], js: [javascript()] };
const dark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export default function Workspace() {
  const { id } = useParams();
  const { s, choose } = useProgress();
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) return <Navigate to="/" replace />;

  const choice = choiceFor(s, project.id);
  const untouched = !s.drafts[project.id] && !s.completed[project.id];
  // a fresh project with themed versions starts with ONE small decision, not a wall of options
  if (!choice && hasVariants(project.id) && untouched) {
    return <ChooseVersion projectId={project.id} onStart={(c) => choose(project.id, c)} />;
  }
  return <Inner key={project.id} projectId={project.id} />;
}

/* ------------------------------------------------------------------ choose version ----------- */
function ChooseVersion({ projectId, onStart }: { projectId: string; onStart: (c: { variant: string; mode: Mode }) => void }) {
  const base = PROJECTS.find((p) => p.id === projectId)!;
  const variants = VARIANTS[projectId] ?? [];
  const [variant, setVariant] = useState(variants[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("guided");
  const node = nodeById(base.nodeId);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="animate-rise">
        <Link to="/roadmap" className="muted text-sm hover:text-fg">← {node.title}</Link>
        <h1 className="mt-2 text-3xl font-extrabold">{base.title}</h1>
        <p className="muted mt-1">{base.goal} <span className="chip ml-1">⏱ ~{base.minutes} min</span></p>

        <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-muted">1 · Pick a theme</h2>
        <p className="muted text-sm">Same skills, your story. Choose what you'd enjoy building.</p>
        <div className="stagger mt-3 grid gap-3 sm:grid-cols-3">
          {variants.map((v) => (
            <button key={v.id} className="choice !flex-col !items-start" aria-pressed={variant === v.id} onClick={() => setVariant(v.id)}>
              <span className="text-3xl">{v.emoji}</span>
              <span className="font-semibold">{v.label}</span>
              <span className="muted text-xs">{v.blurb}</span>
            </button>
          ))}
        </div>

        <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-muted">2 · How do you want to work?</h2>
        <div className="stagger mt-3 grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <button key={m.id} className="choice !items-start" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              <span className="text-2xl">{m.emoji}</span>
              <span>
                <span className="block font-semibold">{m.label}</span>
                <span className="muted text-xs">{m.blurb}</span>
              </span>
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-lg mt-8 w-full" onClick={() => onStart({ variant, mode })}>Start building →</button>
        <p className="muted mt-3 text-center text-xs">You can't break anything: your work saves automatically and you can reset any time.</p>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ workspace ---------------- */
function Inner({ projectId }: { projectId: string }) {
  const nav = useNavigate();
  const { s, saveDraft, recordAttempt, useHint, complete, nodeUnlocked } = useProgress();
  const already = s.completed[projectId];
  const project = useMemo(() => resolveProject(projectId, choiceFor(s, projectId)), [projectId, s.choices]); // eslint-disable-line react-hooks/exhaustive-deps
  const challenge = project.mode === "challenge";

  const [code, setCode] = useState<Code>(already?.code ?? s.drafts[projectId] ?? project.starter);
  const [tab, setTab] = useState<Tab>("html");
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [win, setWin] = useState<{ xp: number; streak: number; levelUp: boolean } | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [fbErr, setFbErr] = useState("");
  const [fbBusy, setFbBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [prefill, setPrefill] = useState("");
  const [srcDoc, setSrcDoc] = useState(buildDoc(code));
  const first = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setSrcDoc(buildDoc(code));
      if (!first.current) saveDraft(projectId, code);
      first.current = false;
    }, 400);
    return () => clearTimeout(t);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const passedCount = results?.filter((r) => r.passed).length ?? 0;
  const failing = results?.some((r) => !r.passed) ?? false;
  const next = useMemo(() => (win || already ? recommendNext(s, nodeUnlocked) : null), [win, already, s, nodeUnlocked]);
  const node = nodeById(project.nodeId);

  const run = async () => {
    setRunning(true);
    setFb(null);
    setFbErr("");
    const { results, errors } = await runChecks(code, project.checks);
    setResults(results);
    setErrors(errors);
    const all = results.every((r) => r.passed);
    recordAttempt(projectId, all, project.skill);
    if (all && !already) setWin(complete(projectId, code));
    setRunning(false);
  };

  const aiFeedback = async () => {
    if (!results) return;
    setFbBusy(true);
    setFbErr("");
    try {
      setFb(await getFeedback({ project: { title: project.title, goal: project.goal }, code, results: results.map((r) => ({ label: r.label, passed: r.passed })) }));
    } catch (e) {
      setFbErr(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setFbBusy(false);
    }
  };

  const reveal = (cid: string) => {
    if (!shown[cid]) useHint(projectId);
    setShown({ ...shown, [cid]: true });
  };
  const askTutor = (text = "") => {
    setPrefill(text);
    setChatOpen(true);
  };

  return (
    <main className="mx-auto grid max-w-[1500px] gap-3 px-3 py-3 lg:h-[calc(100vh-57px)] lg:grid-cols-[340px_minmax(0,1fr)_minmax(0,1fr)]">
      <Confetti fire={!!win} />

      {/* LEFT: what to do (one thing at a time) */}
      <section className="card flex flex-col gap-4 overflow-y-auto lg:h-full">
        <div>
          <Link to="/roadmap" className="muted text-xs hover:text-fg">← {node.title}</Link>
          <h1 className="mt-1 text-xl font-extrabold">{project.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.variantLabel && <span className="chip chip-primary">{project.variantLabel}</span>}
            <span className="chip">{challenge ? "⚡ Challenge" : "🧭 Guided"}</span>
            <span className="chip">⏱ ~{project.minutes} min</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed"><b>Goal:</b> {project.goal}</p>

        {challenge ? (
          <p className="muted rounded-xl border border-dashed border-line p-3 text-xs">⚡ Challenge mode: no step list. Use the checks below as your target. Earns 1.5× XP.</p>
        ) : (
          <details open={!results} className="group rounded-xl border border-line p-3">
            <summary className="cursor-pointer list-none text-sm font-bold">
              <span className="muted mr-1 inline-block transition group-open:rotate-90">▸</span> Steps <span className="muted font-normal">({project.steps.length})</span>
            </summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
              {project.steps.map((st) => <li key={st}>{st}</li>)}
            </ol>
          </details>
        )}

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Checks</h2>
            <span className="muted text-xs tabular-nums">{results ? `${passedCount}/${results.length}` : `${project.checks.length} to pass`}</span>
          </div>
          <div className="bar mt-2"><span style={{ width: `${results ? (passedCount / results.length) * 100 : 0}%` }} /></div>
          <ul className="mt-3 grid gap-2" aria-live="polite">
            {(results ?? project.checks.map((c) => ({ ...c, passed: null as boolean | null }))).map((r) => (
              <li key={r.id} className={`rounded-xl border p-2.5 text-sm transition ${r.passed === true ? "border-success/50 bg-success-soft" : r.passed === false ? "border-danger/40" : "border-line"}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${r.passed === true ? "animate-pop bg-success text-white" : r.passed === false ? "bg-danger text-white" : "bg-surface2 text-muted"}`} aria-hidden>
                    {r.passed === true ? "✓" : r.passed === false ? "✕" : ""}
                  </span>
                  <span className="flex-1">{r.label}</span>
                </div>
                {r.passed === false && (shown[r.id] ? (
                  <p className="animate-rise mt-2 rounded-lg bg-warn-soft p-2 text-xs">💡 {r.hint}</p>
                ) : (
                  <button className="mt-1.5 text-xs font-semibold text-primary hover:underline" onClick={() => reveal(r.id)}>Need a nudge?</button>
                ))}
              </li>
            ))}
          </ul>
        </div>

        {errors.length > 0 && (
          <div className="rounded-xl bg-danger-soft p-3 text-xs text-danger"><b>Your JavaScript has an error:</b> {errors[0]}</div>
        )}

        <div className="mt-auto flex flex-col gap-2">
          {/* one clear next action: after a failed run the tutor becomes the suggested move */}
          {failing && !win && (
            <button className="animate-rise rounded-xl bg-primary-soft p-3 text-left text-sm" onClick={() => askTutor("One of my checks is failing. Without giving me the answer, help me understand why.")}>
              <b className="text-primary">Stuck?</b> <span className="muted">Ask the tutor about the failing check →</span>
            </button>
          )}
          <button className="btn btn-primary btn-lg" onClick={run} disabled={running}>{running ? "Checking…" : "▶ Check my work"}</button>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={aiFeedback} disabled={!results || fbBusy} title={results ? "" : "Run the checks first"}>{fbBusy ? "…" : "✨ AI feedback"}</button>
            <button className="btn btn-ghost" onClick={() => askTutor()}>💬 Ask tutor</button>
          </div>
          <button className="text-xs underline muted" onClick={() => { if (confirm("Reset to the starter code? Your work will be lost.")) { setCode(project.starter); setResults(null); } }}>Reset code</button>
        </div>
      </section>

      {/* MIDDLE: editor */}
      <section className="card flex min-h-[380px] flex-col !p-0 lg:h-full">
        <div role="tablist" className="flex border-b border-line px-2">
          {(["html", "css", "js"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition ${tab === t ? "text-primary" : "muted hover:text-fg"}`}>
              {t.toUpperCase()}
              {tab === t && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <CodeMirror value={code[tab]} height="100%" theme={dark ? "dark" : "light"} extensions={LANG[tab]} onChange={(v) => setCode((c) => ({ ...c, [tab]: v }))} basicSetup={{ lineNumbers: true, foldGutter: false }} style={{ height: "100%", fontSize: 14 }} />
        </div>
      </section>

      {/* RIGHT: result */}
      <section className="flex min-h-[380px] flex-col gap-3 lg:h-full lg:overflow-y-auto">
        {win && (
          <div className="hero-card animate-pop !p-5">
            <h2 className="text-xl font-extrabold">🎉 Project complete!</h2>
            <p className="mt-1 text-3xl font-extrabold text-gradient">+<CountUp value={win.xp} /> XP</p>
            <p className="muted mt-2 text-sm">{project.solutionNote}</p>
            <p className="mt-2 text-sm">{win.levelUp && <b className="mr-3">⬆️ Level up!</b>}🔥 {win.streak}-day streak</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {next ? <button className="btn btn-primary" onClick={() => nav(`/project/${next.project.id}`)}>Next: {next.project.title} →</button> : <Link className="btn btn-primary" to="/portfolio">See portfolio</Link>}
              <Link className="btn btn-ghost" to="/portfolio">Portfolio</Link>
            </div>
          </div>
        )}

        <div className="card flex min-h-[280px] flex-1 flex-col !p-0">
          <div className="muted flex items-center justify-between border-b border-line px-4 py-2 text-xs font-semibold">
            <span>Live preview</span><span className="chip">updates as you type</span>
          </div>
          <iframe title="Live preview" sandbox="allow-scripts" srcDoc={srcDoc} className="w-full flex-1 rounded-b-2xl border-0 bg-white" />
        </div>

        {(fb || fbErr) && (
          <div className="card animate-rise text-sm">
            <h2 className="font-bold">✨ AI feedback</h2>
            {fbErr && <p className="muted mt-1">{fbErr}</p>}
            {fb && (
              <div className="mt-2 grid gap-2">
                {fb.strengths.length > 0 && <div><b className="text-success">What's working</b><ul className="list-disc pl-5">{fb.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                {fb.fixes.length > 0 && <div><b className="text-accent">Try this next</b><ul className="list-disc pl-5">{fb.fixes.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                {fb.next_step && <p className="muted">👉 {fb.next_step}</p>}
              </div>
            )}
          </div>
        )}
      </section>

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        prefill={prefill}
        context={() => ({
          project: { title: project.title, goal: project.goal },
          code,
          results: results?.map((r) => ({ label: r.label, passed: r.passed })),
          attempts: s.attempts[projectId] ?? 0,
          mode: project.mode,
          hasFailing: failing,
        })}
      />
    </main>
  );
}
