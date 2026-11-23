import { PROJECTS } from "../data/projects";
import { nodeById } from "../data/roadmap";
import type { Project } from "../data/types";
import type { State } from "./progress";

/** Mastery (0..1) -> the difficulty we want next. Kept deliberately simple and explainable. */
const targetDifficulty = (m: number) => (m < 0.35 ? 1 : m < 0.7 ? 2 : 3);

/** Everything the learner could do right now (unlocked, not finished, not skipped). */
export function openProjects(s: State, nodeUnlocked: (id: string) => boolean): Project[] {
  return PROJECTS.filter((p) => !s.completed[p.id] && !s.skipped.includes(p.nodeId) && nodeUnlocked(p.nodeId));
}

export function recommendNext(
  s: State,
  nodeUnlocked: (id: string) => boolean,
): { project: Project; reason: string } | null {
  // never suggest projects for topics the learner already proved they know (placement quiz)
  const open = PROJECTS.filter((p) => !s.completed[p.id] && !s.skipped.includes(p.nodeId) && nodeUnlocked(p.nodeId));
  if (!open.length) return null;

  const scored = open.map((p, order) => {
    const m = s.mastery[p.skill] ?? 0.3;
    return { p, order, gap: Math.abs(p.difficulty - targetDifficulty(m)), m };
  });
  // a pinned focus topic wins, then the difficulty closest to what the learner is ready for
  const pinned = (x: { p: Project }) => (s.focus && x.p.nodeId === s.focus ? 0 : 1);
  scored.sort((a, b) => pinned(a) - pinned(b) || a.gap - b.gap || a.order - b.order);
  const best = scored[0];

  const done = Object.keys(s.completed).length;
  let reason: string;
  if (s.focus && best.p.nodeId === s.focus) reason = `You pinned ${nodeById(best.p.nodeId).title} as your focus.`;
  else if (done === 0) reason = "A gentle start: you'll build something real in about " + best.p.minutes + " minutes.";
  else if (best.m >= 0.7) reason = `You're strong at ${nodeById(best.p.nodeId).title}, so here's a tougher one.`;
  else if (best.m < 0.35) reason = `Let's build confidence with ${nodeById(best.p.nodeId).title} first.`;
  else reason = `Next step on your roadmap: ${nodeById(best.p.nodeId).title}.`;
  return { project: best.p, reason };
}
