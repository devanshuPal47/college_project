export type Check = {
  id: string;
  label: string;
  /** Hint shown (tiered) when this check fails. */
  hint: string;
  /**
   * JS expression body evaluated inside the learner's preview.
   * Receives `doc` (document) and `win` (window); must return a truthy value to pass.
   */
  test: string;
};

export type Project = {
  id: string;
  nodeId: string;
  title: string;
  skill: string;
  difficulty: 1 | 2 | 3;
  minutes: number;
  goal: string;
  steps: string[];
  starter: { html: string; css: string; js: string };
  checks: Check[];
  solutionNote: string;
};

export type Resource = { title: string; url: string; kind: "docs" | "tutorial" | "video" };

export type RoadmapNode = {
  id: string;
  title: string;
  summary: string;
  why: string;
  requires: string[];
  resources: Resource[];
  comingSoon?: boolean;
};
