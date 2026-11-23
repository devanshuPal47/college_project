import { useEffect, useRef, useState } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced");

/** Animates a number up to its new value so XP and streak changes are noticed, not just replaced. */
export function CountUp({ value, ms = 700 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion() || from.current === value) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{shown}</>;
}

/** One short, tasteful burst for finishing a project. Self-cleaning; skipped when motion is reduced. */
export function Confetti({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire || prefersReducedMotion()) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const colors = ["#8d7ff8", "#a65cf7", "#38c2f2", "#3dd68c", "#ffb224", "#ff6369"];
    const parts = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.25,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 16 * dpr,
      vy: (-Math.random() * 14 - 4) * dpr,
      s: (Math.random() * 6 + 4) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - start) / 2200;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.38 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.6);
        ctx.restore();
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}

/** In-app reduce-motion switch, remembered per browser (a UI preference, not learner data). */
export function useMotionPreference() {
  const [reduced, setReduced] = useState(() => {
    try {
      return localStorage.getItem("learnloop.motion") === "reduced";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (reduced) document.documentElement.dataset.motion = "reduced";
    else delete document.documentElement.dataset.motion;
    try {
      localStorage.setItem("learnloop.motion", reduced ? "reduced" : "full");
    } catch {
      /* ignore */
    }
  }, [reduced]);
  return [reduced, setReduced] as const;
}
