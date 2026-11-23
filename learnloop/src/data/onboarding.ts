import { PROJECTS } from "./projects";

export type Option = { id: string; icon: string; title: string; sub: string; disabled?: boolean; tag?: string };

export const GOALS: Option[] = [
  { id: "build", icon: "🚀", title: "Build my own websites & apps", sub: "Turn ideas into something real" },
  { id: "job", icon: "💼", title: "Get a developer job", sub: "Build a portfolio employers can see" },
  { id: "college", icon: "🎓", title: "Keep up with college", sub: "Practice what my course teaches" },
  { id: "switch", icon: "🔄", title: "Switch careers", sub: "Start a new path in tech" },
  { id: "curious", icon: "🧪", title: "Just curious", sub: "Try it and see if I like it" },
];

export const TRACKS: Option[] = [
  { id: "web", icon: "🌐", title: "Web Development", sub: "HTML, CSS, JavaScript, then React", tag: "Start here" },
  { id: "py", icon: "🐍", title: "Python & SQL", sub: "Scripts, data and databases", disabled: true, tag: "Coming soon" },
  { id: "backend", icon: "🗄️", title: "Backend & APIs", sub: "Servers, auth and databases", disabled: true, tag: "Coming soon" },
  { id: "data", icon: "📊", title: "Data & AI", sub: "Analysis, models and notebooks", disabled: true, tag: "Coming soon" },
];

export const EXPERIENCE: Option[] = [
  { id: "new", icon: "🌱", title: "Brand new", sub: "I've never written code" },
  { id: "some", icon: "🌿", title: "I've dabbled", sub: "A bit of HTML or JavaScript" },
  { id: "comfortable", icon: "🌳", title: "Comfortable", sub: "I've built a few things already" },
];

export const PACE: (Option & { minutes: number })[] = [
  { id: "10", minutes: 10, icon: "☕", title: "Casual", sub: "10 min a day" },
  { id: "20", minutes: 20, icon: "📘", title: "Regular", sub: "20 min a day" },
  { id: "30", minutes: 30, icon: "🔥", title: "Serious", sub: "30 min a day" },
  { id: "60", minutes: 60, icon: "⚡", title: "Intense", sub: "1 hour a day" },
];

export const PLACEMENT = [
  { q: "Which tag makes the biggest heading?", options: ["<head>", "<h1>", "<title>"], answer: 1 },
  { q: "Which CSS property rounds an element's corners?", options: ["corner-style", "round", "border-radius"], answer: 2 },
  { q: "After `let n = 0; n++;` what is n?", options: ["0", "1", "undefined"], answer: 1 },
];

/** Roadmap topics the learner has already proven, from their placement answers. */
export function skippedFromPlacement(correct: boolean[]): string[] {
  const out: string[] = [];
  if (correct[0]) out.push("html");
  if (correct[0] && correct[1]) out.push("css");
  if (correct.length === PLACEMENT.length && correct.every(Boolean)) out.push("js");
  return out;
}

/** Whole weeks to finish the available projects at a given daily pace, studying 5 days a week. */
export function weeksToFinish(dailyMinutes: number, skipped: string[]): number {
  const remaining = PROJECTS.filter((p) => !skipped.includes(p.nodeId)).reduce((sum, p) => sum + p.minutes, 0);
  return Math.max(1, Math.ceil(remaining / (dailyMinutes * 5)));
}

export const goalTitle = (id: string) => GOALS.find((g) => g.id === id)?.title ?? "Learn to code";
