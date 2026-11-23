import { useEffect, useMemo, useRef, useState } from "react";
import { FAQ, matchFaq, type Faq } from "../data/faq";
import { chat, type ChatMsg } from "../lib/ai";
import { ApiError } from "../lib/api";

/** Tiny, safe markdown: ```code blocks```, `inline code` and **bold**. Builds elements, never raw HTML. */
function Md({ text }: { text: string }) {
  const parts = text.split(/```(?:\w*)\n?([\s\S]*?)```/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="my-1.5 overflow-x-auto rounded-lg bg-black/80 p-2.5 font-mono text-xs text-slate-100"><code>{part.trim()}</code></pre>
        ) : (
          <span key={i}>
            {part.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((seg, j) =>
              seg.startsWith("`") && seg.endsWith("`") && seg.length > 2 ? (
                <code key={j} className="rounded bg-black/10 px-1 font-mono text-[0.85em] dark:bg-white/10">{seg.slice(1, -1)}</code>
              ) : seg.startsWith("**") && seg.endsWith("**") && seg.length > 4 ? (
                <b key={j}>{seg.slice(2, -2)}</b>
              ) : seg.startsWith("*") && seg.endsWith("*") && seg.length > 2 ? (
                <i key={j}>{seg.slice(1, -1)}</i>
              ) : (
                seg
              ),
            )}
          </span>
        ),
      )}
    </>
  );
}

type Msg = ChatMsg & { instant?: boolean };
type Ctx = { project: unknown; code: unknown; results?: unknown; attempts: number; mode: string; hasFailing: boolean };
type Props = { open: boolean; onClose: () => void; context: () => Ctx; prefill?: string };

const LEVELS = [
  { id: 1, label: "Nudge", tip: "A small pointer. No code." },
  { id: 2, label: "Hint", tip: "Names the exact idea you need." },
  { id: 3, label: "Walk-through", tip: "Explains the concept step by step." },
] as const;

// templates: each turns a vague feeling ("I'm stuck") into a prompt the tutor can actually use
const TEMPLATES: { group: string; items: { label: string; prompt: string }[] }[] = [
  { group: "I'm stuck", items: [
    { label: "Why is a check failing?", prompt: "One of my checks is failing. Without giving me the answer, help me understand why." },
    { label: "I don't get the task", prompt: "I don't understand what this project is asking me to do. Can you explain the goal in simpler words?" },
    { label: "Where do I start?", prompt: "I'm not sure where to start. What should my very first step be?" },
  ] },
  { group: "Teach me", items: [
    { label: "Explain the key concept", prompt: "What is the main concept I need for this project? Explain it simply with a small unrelated example." },
    { label: "Show a tiny example", prompt: "Show me a tiny example of the main idea I need here, on a different topic than my project." },
    { label: "Why does this work?", prompt: "Can you explain why my current code behaves the way it does?" },
  ] },
  { group: "Review", items: [
    { label: "Review my code", prompt: "Review my code so far. What's good, and what's the one most important thing to improve?" },
    { label: "What should I do next?", prompt: "Based on my code and my checks, what is the single next thing I should do?" },
    { label: "Make it better", prompt: "My checks pass. How could I improve this project to learn more from it?" },
  ] },
];

export default function ChatDrawer({ open, onClose, context, prefill }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your tutor. I'll guide you with hints rather than hand over answers, because that's how it sticks. Pick a quick question below or ask your own." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [group, setGroup] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => matchFaq(input), [input]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);
  useEffect(() => {
    if (open && prefill) setInput(prefill);
  }, [open, prefill]);

  const showInstant = (f: Faq) => {
    setMsgs((m) => [...m, { role: "user", content: f.title }, { role: "assistant", content: f.answer, instant: true }]);
    setInput("");
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const c = context();
      const reply = await chat({
        messages: next.slice(1).filter((m) => !m.instant).map(({ role, content }) => ({ role, content })),
        project: c.project, code: c.code, results: c.results, attempts: c.attempts, mode: c.mode, hint_level: level,
      });
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: e instanceof ApiError ? e.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const ctx = context();
  return (
    <aside className="animate-rise card fixed bottom-0 right-0 z-30 flex h-[78vh] w-full flex-col !rounded-b-none !p-0 sm:bottom-4 sm:right-4 sm:h-[600px] sm:w-[420px] sm:!rounded-2xl" aria-label="AI tutor chat">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <b>🤖 Ask the tutor</b>
          <p className="muted text-[11px]">{ctx.attempts === 0 ? "Tip: press “Check my work” first. It makes the help much better." : "I can see your code and your check results."}</p>
        </div>
        <button onClick={onClose} className="muted rounded p-1 text-lg leading-none hover:text-fg" aria-label="Close chat">✕</button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            {m.instant && <p className="mb-0.5 text-[11px] font-semibold text-success">⚡ Instant answer</p>}
            <span data-msg={m.role} className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left ${m.role === "user" ? "bg-primary text-white" : "bg-surface2"}`}>
              <Md text={m.content} />
            </span>
          </div>
        ))}
        {busy && <p className="muted text-xs"><span className="inline-block animate-pulse">Thinking…</span></p>}
        <div ref={end} />
      </div>

      <div className="border-t border-line px-4 pt-3">
        <div className="flex items-center gap-2" role="radiogroup" aria-label="How much help?">
          <span className="muted text-[11px] font-semibold uppercase tracking-wide">Help level</span>
          {LEVELS.map((l) => (
            <button key={l.id} role="radio" aria-checked={level === l.id} title={l.tip} onClick={() => setLevel(l.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${level === l.id ? "bg-primary text-white" : "bg-surface2 text-muted hover:text-fg"}`}>
              {l.label}
            </button>
          ))}
        </div>

        {suggestions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((f) => (
              <button key={f.id} onClick={() => showInstant(f)} className="chip chip-primary hover:brightness-110">⚡ {f.title}</button>
            ))}
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex gap-3 text-xs font-semibold">
              {TEMPLATES.map((t, i) => (
                <button key={t.group} onClick={() => setGroup(i)} className={group === i ? "text-primary" : "muted hover:text-fg"}>{t.group}</button>
              ))}
              <button onClick={() => setGroup(-1)} className={group === -1 ? "text-primary" : "muted hover:text-fg"}>⚡ Common questions</button>
            </div>
            <div className="mt-1.5 flex max-h-[68px] flex-wrap gap-1.5 overflow-y-auto">
              {group === -1
                ? FAQ.slice(0, 8).map((f) => <button key={f.id} onClick={() => showInstant(f)} className="chip chip-primary hover:brightness-110">⚡ {f.title}</button>)
                : TEMPLATES[group].items.map((t) => <button key={t.label} onClick={() => send(t.prompt)} disabled={busy} className="chip hover:text-fg disabled:opacity-50">{t.label}</button>)}
            </div>
          </div>
        )}
      </div>

      <form className="flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about this project…" className="field" aria-label="Your question" />
        <button className="btn btn-primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </aside>
  );
}
