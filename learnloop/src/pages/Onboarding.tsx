import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { freshState, useProgress, type Profile } from "../lib/progress";
import { EXPERIENCE, GOALS, PACE, PLACEMENT, TRACKS, skippedFromPlacement, weeksToFinish, type Option } from "../data/onboarding";
import { Logo } from "../components/Logo";

type StepId = "welcome" | "goal" | "track" | "experience" | "placement" | "pace" | "tryit" | "account";
type Draft = { goal: string; track: string; experience: Profile["experience"] | ""; correct: boolean[]; dailyMinutes: number; sparked: boolean };

const EMPTY: Draft = { goal: "", track: "web", experience: "", correct: [], dailyMinutes: 0, sparked: false };

/** `anon`: new visitor, ends with account creation. `existing`: signed-in user who hasn't set up a profile yet. */
export default function Onboarding({ mode }: { mode: "anon" | "existing" }) {
  const nav = useNavigate();
  const auth = useAuth();
  const progress = mode === "existing" ? useProgress() : null; // eslint-disable-line react-hooks/rules-of-hooks
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [stepIdx, setStepIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);

  const steps = useMemo<StepId[]>(() => {
    const s: StepId[] = [];
    if (mode === "anon") s.push("welcome");
    s.push("goal", "track", "experience");
    if (draft.experience && draft.experience !== "new") s.push("placement");
    s.push("pace", "tryit");
    if (mode === "anon") s.push("account");
    return s;
  }, [mode, draft.experience]);

  const step = steps[stepIdx];
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const next = () => setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  const back = () => (step === "placement" && qIdx > 0 ? setQIdx(qIdx - 1) : setStepIdx((i) => Math.max(0, i - 1)));

  const skipped = skippedFromPlacement(draft.correct);
  const profile: Profile = { goal: draft.goal || "curious", track: draft.track, experience: draft.experience || "new", dailyMinutes: draft.dailyMinutes || 20 };
  const initialState = () => freshState({ onboarded: true, profile, skipped, xp: draft.sparked ? 10 : 0 });

  const finishExisting = () => {
    progress?.completeOnboarding(profile, skipped);
    nav("/plan", { replace: true });
  };
  const skipSetup = () => {
    progress?.completeOnboarding({ goal: "curious", track: "web", experience: "new", dailyMinutes: 20 }, []);
    nav("/", { replace: true });
  };

  const answerPlacement = (idx: number) => {
    const correct = [...draft.correct];
    correct[qIdx] = idx === PLACEMENT[qIdx].answer;
    set({ correct });
    if (qIdx + 1 < PLACEMENT.length) setQIdx(qIdx + 1);
    else next();
  };

  const showBar = step !== "welcome";
  const pct = Math.round((stepIdx / (steps.length - 1)) * 100);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-10 pt-5">
      <header className="flex min-h-9 items-center gap-3">
        {showBar && <button onClick={back} className="btn btn-ghost !px-3 !py-1.5" aria-label="Go back" disabled={stepIdx === 0}>←</button>}
        {showBar && (
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%` }} />
          </div>
        )}
        {mode === "existing" && (
          <button onClick={skipSetup} className="muted text-sm underline">Skip</button>
        )}
      </header>

      <section key={step + qIdx} className="animate-rise flex flex-1 flex-col justify-center py-8">
        {step === "welcome" && (
          <div className="text-center">
            <Logo size={56} />
            <h1 className="mt-6 text-4xl font-extrabold sm:text-5xl">Learn to code by <span className="text-primary">building</span> real things.</h1>
            <p className="muted mx-auto mt-4 max-w-md text-lg">Small projects. Instant feedback. A clear path from zero to job-ready skills.</p>
            <ul className="mx-auto mt-6 grid max-w-sm gap-2 text-left text-sm">
              {[
                ["🧩", "Bite-sized projects you can finish in one sitting"],
                ["⚡", "Automatic checks and AI feedback in seconds"],
                ["🗺️", "A roadmap that adapts to how you're doing"],
              ].map(([i, t]) => (
                <li key={t} className="flex items-center gap-3"><span className="text-lg">{i}</span>{t}</li>
              ))}
            </ul>
            <button className="btn btn-primary btn-lg mt-8" onClick={next}>Get started <span className="opacity-70">· 2 min</span></button>
            <p className="muted mt-4 text-sm">Already learning with us? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
          </div>
        )}

        {step === "goal" && (
          <Question title="What brings you here?" hint="This helps us shape your plan. You can change it later.">
            <Choices options={GOALS} value={draft.goal} onPick={(id) => set({ goal: id })} />
            <Continue disabled={!draft.goal} onClick={next} />
          </Question>
        )}

        {step === "track" && (
          <Question title="What do you want to learn first?" hint="Web fundamentals carry over to every other track, so this is the best place to begin.">
            <Choices options={TRACKS} value={draft.track} onPick={(id) => set({ track: id })} />
            <Continue disabled={!draft.track} onClick={next} />
          </Question>
        )}

        {step === "experience" && (
          <Question title="How much have you coded before?" hint="No wrong answer. It only decides where you start.">
            <Choices options={EXPERIENCE} value={draft.experience} onPick={(id) => set({ experience: id as Profile["experience"], correct: [] })} />
            <Continue disabled={!draft.experience} onClick={next} />
          </Question>
        )}

        {step === "placement" && (
          <Question title={`Quick check · ${qIdx + 1} of ${PLACEMENT.length}`} hint="Skip what you already know. Not graded, and guesses are fine.">
            <p className="text-xl font-bold">{PLACEMENT[qIdx].q}</p>
            <div className="mt-4 grid gap-2">
              {PLACEMENT[qIdx].options.map((o, idx) => (
                <button key={o} onClick={() => answerPlacement(idx)} className="choice font-mono text-sm">{o}</button>
              ))}
              <button onClick={() => answerPlacement(-1)} className="btn btn-ghost justify-start">I'm not sure</button>
            </div>
          </Question>
        )}

        {step === "pace" && (
          <Question title="How much time can you give each day?" hint="Small and steady beats big and rare. You can change this anytime.">
            <Choices options={PACE} value={draft.dailyMinutes ? String(draft.dailyMinutes) : ""} onPick={(id) => set({ dailyMinutes: Number(id) })} />
            {draft.dailyMinutes > 0 && (
              <p className="animate-rise mt-4 rounded-xl bg-primary-soft p-3 text-sm">
                🎯 At <b>{draft.dailyMinutes} min a day</b>, you could finish your first track in about{" "}
                <b>{weeksToFinish(draft.dailyMinutes, skipped)} week{weeksToFinish(draft.dailyMinutes, skipped) === 1 ? "" : "s"}</b>.
              </p>
            )}
            <Continue disabled={!draft.dailyMinutes} onClick={next} />
          </Question>
        )}

        {step === "tryit" && <TryIt sparked={draft.sparked} onSpark={() => set({ sparked: true })} onContinue={mode === "existing" ? finishExisting : next} last={mode === "existing"} />}

        {step === "account" && <AccountStep profile={profile} initialState={initialState} onDone={() => nav("/plan", { replace: true })} register={auth.register} />}
      </section>
    </main>
  );
}

/* ---------------------------------------------------------------- building blocks -------------- */

function Question({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="muted mt-2">{hint}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Choices({ options, value, onPick }: { options: Option[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="grid gap-3" role="group">
      {options.map((o) => (
        <button key={o.id} className="choice" aria-pressed={value === o.id} disabled={o.disabled} onClick={() => onPick(o.id)}>
          <span className="text-2xl" aria-hidden>{o.icon}</span>
          <span className="flex-1">
            <span className="block font-semibold">{o.title}</span>
            <span className="muted text-sm">{o.sub}</span>
          </span>
          {o.tag && <span className={`chip ${o.id === "web" ? "!bg-primary-soft !text-primary" : ""}`}>{o.tag}</span>}
        </button>
      ))}
    </div>
  );
}

function Continue({ disabled, onClick, label = "Continue" }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <button className="btn btn-primary btn-lg mt-6 w-full" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

/** A 20-second win before asking for an account: edit a heading and watch the page change. */
function TryIt({ sparked, onSpark, onContinue, last }: { sparked: boolean; onSpark: () => void; onContinue: () => void; last: boolean }) {
  const [code, setCode] = useState("<h1>Hello, world</h1>\n<p>Edit the text above to your name.</p>");
  const changed = /<h1>\s*(?!Hello, world)[^<\s][^<]*<\/h1>/i.test(code);
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Write your first line of code</h1>
      <p className="muted mt-2">Change <code className="rounded bg-surface2 px-1 font-mono">Hello, world</code> to your name and watch the page react.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <textarea
          aria-label="HTML editor"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="field h-44 resize-none font-mono text-[13px] leading-relaxed"
        />
        <iframe title="Preview" sandbox="" srcDoc={`<body style="font-family:system-ui;padding:12px">${code}</body>`} className="h-44 w-full rounded-lg border border-line bg-white" />
      </div>
      {changed && !sparked && (
        <button className="btn btn-primary animate-pop mt-4" onClick={onSpark}>✨ That worked! Claim +10 XP</button>
      )}
      {sparked && <p className="animate-pop mt-4 rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">🎉 +10 XP: you just wrote real HTML. That's how every project here starts.</p>}
      <button className="btn btn-primary btn-lg mt-5 w-full" onClick={onContinue} disabled={!sparked}>{last ? "Build my plan" : "Save my progress"}</button>
      <button className="muted mt-3 w-full text-sm underline" onClick={onContinue}>Skip this</button>
    </div>
  );
}

function AccountStep({
  profile, initialState, onDone, register,
}: {
  profile: Profile;
  initialState: () => unknown;
  onDone: () => void;
  register: (p: { email: string; password: string; displayName: string }, initial?: unknown) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rules = [
    { ok: password.length >= 8, label: "8+ characters" },
    { ok: /[a-zA-Z]/.test(password) && /[^a-zA-Z]/.test(password), label: "letters and a number or symbol" },
  ];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register({ email, password, displayName: name }, initialState());
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 className="text-3xl font-extrabold">Save your progress</h1>
      <p className="muted mt-2">Create a free account so your {profile.dailyMinutes}-minute-a-day plan and everything you build is kept safe.</p>
      <div className="mt-6 grid gap-4">
        <label className="grid gap-1.5 text-sm font-semibold">Your name
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} placeholder="Ada" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">Email
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">Password
          <div className="relative">
            <input className="field pr-16" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} maxLength={72} />
            <button type="button" onClick={() => setShow(!show)} className="muted absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold">{show ? "Hide" : "Show"}</button>
          </div>
          <span className="flex flex-wrap gap-x-4 text-xs font-normal">
            {rules.map((r) => <span key={r.label} className={r.ok ? "text-success" : "muted"}>{r.ok ? "✓" : "○"} {r.label}</span>)}
          </span>
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button className="btn btn-primary btn-lg mt-6 w-full" disabled={busy || !rules.every((r) => r.ok) || !name.trim() || !email}>
        {busy ? "Creating your account…" : "Create account & see my plan"}
      </button>
      <p className="muted mt-4 text-center text-sm">Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
    </form>
  );
}
