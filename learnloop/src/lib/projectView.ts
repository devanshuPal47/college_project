import { projectById } from "../data/projects";
import type { Project } from "../data/types";
import { VARIANTS, type Mode } from "../data/variants";
import type { State } from "./progress";

export type Choice = { variant: string; mode: Mode };

export const hasVariants = (projectId: string) => (VARIANTS[projectId]?.length ?? 0) > 0;

export const choiceFor = (s: State, projectId: string): Choice | null => s.choices?.[projectId] ?? null;

/** The project as this learner sees it: base project + their chosen theme (goal, steps, starter code). */
export function resolveProject(projectId: string, choice: Choice | null): Project & { mode: Mode; variantLabel: string | null } {
  const base = projectById(projectId);
  const v = choice ? VARIANTS[projectId]?.find((x) => x.id === choice.variant) : undefined;
  return {
    ...base,
    goal: v?.goal ?? base.goal,
    steps: v?.steps ?? base.steps,
    starter: { ...base.starter, ...(v?.starter ?? {}) },
    mode: choice?.mode ?? "guided",
    variantLabel: v ? `${v.emoji} ${v.label}` : null,
  };
}
