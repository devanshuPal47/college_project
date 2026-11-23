import type { RoadmapNode } from "./types";

// Resources are curated by hand on purpose: the AI never invents links.
export const ROADMAP: RoadmapNode[] = [
  {
    id: "html",
    title: "HTML Basics",
    summary: "The structure of every web page: headings, text, images and links.",
    why: "Everything you see on the web is HTML underneath. CSS and JavaScript both build on it.",
    requires: [],
    resources: [
      { title: "MDN: Structuring content with HTML", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content", kind: "docs" },
      { title: "freeCodeCamp: Responsive Web Design", url: "https://www.freecodecamp.org/learn/2022/responsive-web-design/", kind: "tutorial" },
    ],
  },
  {
    id: "css",
    title: "CSS Basics",
    summary: "Colors, spacing, fonts and borders: making things look good.",
    why: "CSS turns plain structure into something people want to look at.",
    requires: ["html"],
    resources: [
      { title: "MDN: CSS styling basics", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics", kind: "docs" },
      { title: "web.dev: Learn CSS", url: "https://web.dev/learn/css", kind: "tutorial" },
    ],
  },
  {
    id: "layout",
    title: "Layout (Flexbox & Grid)",
    summary: "Put things where you want them, from nav bars to image galleries.",
    why: "Almost every real interface is built from flexbox and grid rows and columns.",
    requires: ["css"],
    resources: [
      { title: "CSS-Tricks: A Complete Guide to Flexbox", url: "https://css-tricks.com/snippets/css/a-guide-to-flexbox/", kind: "tutorial" },
      { title: "CSS-Tricks: A Complete Guide to Grid", url: "https://css-tricks.com/snippets/css/complete-guide-grid/", kind: "tutorial" },
    ],
  },
  {
    id: "js",
    title: "JavaScript Basics",
    summary: "Variables, functions and logic: making pages do things.",
    why: "JavaScript is what makes a page interactive rather than a static document.",
    requires: ["html"],
    resources: [
      { title: "javascript.info: The Modern JavaScript Tutorial", url: "https://javascript.info/", kind: "tutorial" },
      { title: "MDN: JavaScript first steps", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting", kind: "docs" },
    ],
  },
  {
    id: "dom",
    title: "The DOM & Events",
    summary: "Read and change the page from JavaScript, and react to clicks.",
    why: "This is the bridge between your logic and what the user sees. React is built on the same idea.",
    requires: ["js", "css"],
    resources: [
      { title: "javascript.info: Document", url: "https://javascript.info/document", kind: "tutorial" },
      { title: "MDN: DOM scripting introduction", url: "https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Scripting", kind: "docs" },
    ],
  },
  {
    id: "react",
    title: "React",
    summary: "Build interfaces from reusable components.",
    why: "The most widely used UI library; employers ask for it.",
    requires: ["dom", "layout"],
    resources: [{ title: "react.dev: Learn React", url: "https://react.dev/learn", kind: "docs" }],
    comingSoon: true,
  },
];

export const nodeById = (id: string) => ROADMAP.find((n) => n.id === id)!;
