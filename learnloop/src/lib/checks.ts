import type { Check } from "../data/types";
import type { Code } from "./progress";

export type CheckResult = { id: string; label: string; hint: string; passed: boolean };

export function buildDoc(code: Code, withErrorCapture = false) {
  const cap = withErrorCapture
    ? "<script>window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(e.message)});</script>"
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${cap}<style>${code.css}</style></head><body>${code.html}<script>try{${code.js}\n}catch(e){${withErrorCapture ? "window.__errs.push(e.message)" : "console.error(e)"}}</script></body></html>`;
}

/** Runs the checks against the learner's code in a hidden, throwaway iframe. */
export function runChecks(code: Code, checks: Check[]): Promise<{ results: CheckResult[]; errors: string[] }> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.style.cssText = "position:fixed;left:-9999px;width:900px;height:700px;border:0";
    let done = false;
    const finish = (out: { results: CheckResult[]; errors: string[] }) => {
      if (done) return;
      done = true;
      frame.remove();
      resolve(out);
    };
    frame.onload = () => {
      const win = frame.contentWindow as any;
      const doc = frame.contentDocument!;
      const results = checks.map((c) => {
        let passed = false;
        try {
          passed = !!new win.Function("doc", "win", `return (${c.test});`)(doc, win);
        } catch {
          passed = false;
        }
        return { id: c.id, label: c.label, hint: c.hint, passed };
      });
      finish({ results, errors: [...(win.__errs ?? [])] });
    };
    frame.srcdoc = buildDoc(code, true);
    document.body.appendChild(frame);
    setTimeout(() => finish({ results: checks.map((c) => ({ id: c.id, label: c.label, hint: c.hint, passed: false })), errors: ["Preview timed out"] }), 5000);
  });
}
