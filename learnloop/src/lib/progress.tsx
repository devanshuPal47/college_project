import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PROJECTS } from "../data/projects";
import { ROADMAP } from "../data/roadmap";
import { api, ApiError } from "./api";

export type Code = { html: string; css: string; js: string };
export type Completion = { at: string; attempts: number; hints: number; xp: number; code: Code };
export type Profile = { goal: string; track: string; experience: "new" | "some" | "comfortable"; dailyMinutes: number };

export type State = {
  onboarded: boolean;
  profile: Profile | null;
  skipped: string[]; // roadmap nodes proven by the placement quiz
  completed: Record<string, Completion>;
  drafts: Record<string, Code>;
  attempts: Record<string, number>;
  hintsUsed: Record<string, number>;
  mastery: Record<string, number>;
  xp: number;
  streak: number;
  freezes: number;
  lastActive: string; // YYYY-MM-DD (local)
  daily: { date: string; minutes: number };
  /** the learner's chosen theme + mode per project */
  choices: Record<string, { variant: string; mode: "guided" | "challenge" }>;
  /** a roadmap topic the learner pinned as their focus (the recommender prefers it) */
  focus: string | null;
};

export const freshState = (over: Partial<State> = {}): State => ({
  onboarded: false,
  profile: null,
  skipped: [],
  completed: {},
  drafts: {},
  attempts: {},
  hintsUsed: {},
  mastery: {},
  xp: 0,
  streak: 0,
  freezes: 1,
  lastActive: "",
  daily: { date: "", minutes: 0 },
  choices: {},
  focus: null,
  ...over,
});

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayGap = (a: string, b: string) => Math.round((new Date(b + "T00:00").getTime() - new Date(a + "T00:00").getTime()) / 86400000);
export const levelOf = (xp: number) => Math.floor(xp / 100) + 1;

export type SyncStatus = "saved" | "saving" | "error";

/** Pure: what finishing a project changes (XP, streak, mastery, daily minutes). Returns null if already completed. */
export function applyCompletion(p: State, id: string, code: Code): { next: State; result: { xp: number; streak: number; levelUp: boolean } } | null {
  if (p.completed[id]) return null;
  const proj = PROJECTS.find((x) => x.id === id)!;
  const hints = p.hintsUsed[id] ?? 0;
  const attempts = p.attempts[id] ?? 1;
  const bonus = p.choices?.[id]?.mode === "challenge" ? 1.5 : 1; // Challenge mode pays 1.5x
  const xp = Math.round(proj.difficulty * 40 * bonus * Math.max(0.5, 1 - hints * 0.15)); // hints cost at most half
  const today = todayStr();
  let streak = p.streak;
  let freezes = p.freezes;
  if (p.lastActive !== today) {
    const gap = p.lastActive ? dayGap(p.lastActive, today) : 99;
    if (gap === 1) streak += 1;
    else if (gap === 2 && freezes > 0) {
      freezes -= 1; // a freeze quietly covers one missed day
      streak += 1;
    } else streak = 1;
    if (streak > 0 && streak % 7 === 0) freezes += 1;
  }
  const gain = 0.3 * Math.max(0.3, 1 - 0.25 * hints);
  const m = Math.min(1, (p.mastery[proj.skill] ?? 0.3) + gain);
  const before = p.daily.date === today ? p.daily.minutes : 0;
  return {
    result: { xp, streak, levelUp: levelOf(p.xp + xp) > levelOf(p.xp) },
    next: {
      ...p,
      xp: p.xp + xp,
      streak,
      freezes,
      lastActive: today,
      daily: { date: today, minutes: before + proj.minutes },
      mastery: { ...p.mastery, [proj.skill]: m },
      completed: { ...p.completed, [id]: { at: new Date().toISOString(), attempts, hints, xp, code } },
    },
  };
}

type Api = {
  s: State;
  sync: SyncStatus;
  dailyMinutes: number; // minutes of project work done today
  completeOnboarding: (profile: Profile, skipped: string[]) => void;
  saveDraft: (id: string, c: Code) => void;
  choose: (id: string, choice: { variant: string; mode: "guided" | "challenge" }) => void;
  toggleSkip: (nodeId: string) => void;
  setFocus: (nodeId: string | null) => void;
  recordAttempt: (id: string, passed: boolean, skill: string) => void;
  useHint: (id: string) => void;
  complete: (id: string, code: Code) => { xp: number; streak: number; levelUp: boolean };
  nodeDone: (nodeId: string) => boolean;
  nodeUnlocked: (nodeId: string) => boolean;
};

const Ctx = createContext<Api>(null as unknown as Api);
export const useProgress = () => useContext(Ctx);

const SAVE_DELAY_MS = 800;

/** Loads the signed-in user's progress from the API and keeps it saved. Mount only when authenticated. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [sync, setSync] = useState<SyncStatus>("saved");
  const latest = useRef<State | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(() => {
    setLoadError(null);
    api
      .get<{ state: Partial<State> | null }>("/progress")
      .then((r) => {
        const st = freshState(r.state ?? {});
        latest.current = st;
        setS(st);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e : new ApiError("Couldn't load your progress.", "unknown", 0)));
  }, []);
  useEffect(load, [load]);

  const flush = useCallback(async (keepalive = false) => {
    if (!dirty.current || !latest.current) return;
    dirty.current = false;
    setSync("saving");
    try {
      await api.put("/progress", { state: latest.current }, { keepalive });
      setSync(dirty.current ? "saving" : "saved");
    } catch {
      dirty.current = true;
      setSync("error");
    }
  }, []);

  // save shortly after every change, and when the tab is hidden or closed
  // The next state is computed SYNCHRONOUSLY from the ref, then handed to React as a plain value. Nothing with side
  // effects runs inside a setState updater (React may run those twice, or later), so callers can rely on the result.
  const update = useCallback(
    (fn: (p: State) => State) => {
      const prev = latest.current;
      if (!prev) return;
      const next = fn(prev);
      if (next === prev) return;
      latest.current = next;
      setS(next);
      dirty.current = true;
      setSync("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && void flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      clearTimeout(timer.current);
      void flush(true);
    };
  }, [flush]);

  const value = useMemo<Api | null>(() => {
    if (!s) return null;
    const nodeDone = (nodeId: string) => {
      if (s.skipped.includes(nodeId)) return true;
      const ps = PROJECTS.filter((p) => p.nodeId === nodeId);
      return ps.length > 0 && ps.every((p) => s.completed[p.id]); // empty/"coming soon" topics are never done
    };
    const nodeUnlocked = (nodeId: string) => {
      const n = ROADMAP.find((r) => r.id === nodeId)!;
      return !n.comingSoon && n.requires.every(nodeDone);
    };

    return {
      s,
      sync,
      dailyMinutes: s.daily.date === todayStr() ? s.daily.minutes : 0,
      nodeDone,
      nodeUnlocked,
      completeOnboarding: (profile, skipped) => update((p) => ({ ...p, onboarded: true, profile, skipped })),
      saveDraft: (id, c) => update((p) => ({ ...p, drafts: { ...p.drafts, [id]: c } })),
      choose: (id, choice) => update((p) => ({ ...p, choices: { ...p.choices, [id]: choice } })),
      // skipping is always reversible and visible on the roadmap
      toggleSkip: (nodeId) =>
        update((p) => ({ ...p, skipped: p.skipped.includes(nodeId) ? p.skipped.filter((n) => n !== nodeId) : [...p.skipped, nodeId] })),
      setFocus: (nodeId) => update((p) => ({ ...p, focus: nodeId })),
      useHint: (id) => update((p) => ({ ...p, hintsUsed: { ...p.hintsUsed, [id]: (p.hintsUsed[id] ?? 0) + 1 } })),
      recordAttempt: (id, passed, skill) =>
        update((p) => ({
          ...p,
          attempts: { ...p.attempts, [id]: (p.attempts[id] ?? 0) + 1 },
          mastery: passed ? p.mastery : { ...p.mastery, [skill]: Math.max(0, (p.mastery[skill] ?? 0.3) - 0.03) },
        })),
      complete: (id, code) => {
        const prev = latest.current ?? s;
        const out = applyCompletion(prev, id, code);
        if (!out) return { xp: 0, streak: prev.streak, levelUp: false }; // already completed: nothing new to award
        update(() => out.next);
        return out.result;
      },
    };
  }, [s, sync, update]);

  if (loadError) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-bold">We couldn't load your progress</h1>
          <p className="muted mt-1 text-sm">{loadError.message}</p>
          <button className="btn btn-primary mt-4" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }
  if (!value) return <FullScreenLoader label="Loading your progress…" />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-primary" />
        <p className="muted text-sm">{label}</p>
      </div>
    </div>
  );
}
