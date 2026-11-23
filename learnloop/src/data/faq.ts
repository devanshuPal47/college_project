/**
 * Instant answers for the questions every beginner asks. They run in the browser: zero latency, zero AI quota,
 * and the wording is reviewed by a human. Anything not matched here goes to the AI tutor.
 */
export type Faq = { id: string; title: string; keywords: string[]; answer: string };

export const FAQ: Faq[] = [
  { id: "margin-padding", title: "Margin vs padding", keywords: ["margin", "padding", "spacing", "space"], answer: "**Padding** is space *inside* an element, between its content and its border. **Margin** is space *outside* it, between it and its neighbours.\n```css\n.card { padding: 24px; margin: 16px; }\n```\nTip: if the background should grow, use padding. If you just want distance from other things, use margin." },
  { id: "center", title: "How do I center something?", keywords: ["center", "centre", "middle", "align"], answer: "The modern way is flexbox on the **parent**:\n```css\n.parent { display: flex; justify-content: center; align-items: center; }\n```\n`justify-content` centers horizontally, `align-items` vertically. For text only, `text-align: center` is enough." },
  { id: "id-class", title: "id vs class", keywords: ["id", "class", "selector", "selectors"], answer: "A **class** (`.card`) can be reused on many elements. An **id** (`#count`) must be unique on the page. Use classes for styling, and ids when JavaScript needs to find one specific element.\n```html\n<h1 id=\"count\" class=\"big\">0</h1>\n```" },
  { id: "flex-grid", title: "Flexbox vs Grid", keywords: ["flexbox", "flex", "grid", "layout"], answer: "**Flexbox** lays things out along *one* direction (a row or a column), which suits nav bars and toolbars. **Grid** handles rows *and* columns at once, which suits galleries and page layouts.\nRule of thumb: one line of items → flex, a 2D arrangement → grid." },
  { id: "let-const", title: "let vs const vs var", keywords: ["let", "const", "var", "variable", "variables"], answer: "Use **`const`** by default, **`let`** when the value will change (like a counter), and avoid **`var`**.\n```js\nconst button = document.querySelector('#inc');\nlet count = 0;\ncount++;\n```" },
  { id: "dom", title: "What is the DOM?", keywords: ["dom", "document", "object model"], answer: "The **DOM** is the browser's live, tree-shaped copy of your HTML. JavaScript can read and change it, and the page updates instantly.\n```js\ndocument.querySelector('h1').textContent = 'Hello!';\n```" },
  { id: "event-listener", title: "What is an event listener?", keywords: ["event", "listener", "addeventlistener", "click", "handler"], answer: "An event listener runs your function when something happens (a click, a key press...).\n```js\nbutton.addEventListener('click', () => {\n  console.log('clicked!');\n});\n```\nRemember: the code inside the arrow function runs *each time* the event fires." },
  { id: "queryselector", title: "What does querySelector do?", keywords: ["queryselector", "getelementbyid", "find element", "select element"], answer: "`document.querySelector('#id')` finds the **first** element matching a CSS selector and gives it back so you can change it.\n```js\nconst title = document.querySelector('.title');\ntitle.textContent = 'New title';\n```\nIt returns `null` if nothing matches, a common cause of \"cannot read properties of null\"." },
  { id: "blank-page", title: "Why is my preview blank?", keywords: ["blank", "empty", "nothing", "not showing", "doesnt show", "white"], answer: "Common causes: (1) a typo in a tag (a missing `>` or closing tag), (2) your CSS hides it (`display: none`, same color as the background), (3) a JavaScript error stops the script. Check the red error box under the checks, and compare your tags one by one." },
  { id: "link-css", title: "Where does my CSS go?", keywords: ["link css", "stylesheet", "where css", "style tag", "add css"], answer: "In this editor, just use the **CSS tab**: it's applied to your HTML automatically. On a real website you'd link a file with `<link rel=\"stylesheet\" href=\"style.css\">` inside `<head>`." },
  { id: "equals", title: "== vs ===", keywords: ["==", "===", "equal", "equals", "comparison", "compare"], answer: "`===` compares value **and** type (`5 === '5'` is false). `==` converts types first (`5 == '5'` is true), which causes surprises. Prefer `===`." },
  { id: "px-rem", title: "px vs rem vs %", keywords: ["px", "rem", "em", "percent", "units", "responsive"], answer: "`px` is a fixed size. `rem` scales with the user's base font size (good for text and spacing). `%` is relative to the parent. For responsive layouts, mix `rem` for type and `fr`/`%` for widths." },
  { id: "semantic", title: "Why use h1, p, nav...?", keywords: ["semantic", "h1", "why tags", "accessibility", "alt"], answer: "Tags describe *meaning*: `h1` is the main title, `nav` is navigation, `p` is a paragraph. Screen readers and search engines rely on that. And always give images an `alt` that describes them." },
  { id: "console-log", title: "How do I debug?", keywords: ["debug", "console", "log", "error", "bug"], answer: "Add `console.log(value)` to see what a variable holds, and open the browser DevTools (F12) → Console to read it. Read the *first* error message: it usually names the file and line." },
];

/** Cheap keyword scoring: whole-word hits count double, substring hits count once. */
export function matchFaq(query: string, limit = 3): Faq[] {
  const q = query.toLowerCase().trim();
  if (q.length < 3) return [];
  const words = new Set(q.split(/[^a-z0-9=]+/).filter(Boolean));
  return FAQ.map((f) => ({
    f,
    score: f.keywords.reduce((s, k) => s + (words.has(k) ? 2 : q.includes(k) ? 1 : 0), 0) + (q.includes(f.title.toLowerCase()) ? 3 : 0),
  }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}
