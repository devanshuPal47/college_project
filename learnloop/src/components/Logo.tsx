export function Logo({ size = 28, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-extrabold tracking-tight">
      <span
        className="grid place-items-center rounded-[28%] bg-primary text-primary-fg"
        style={{ width: size, height: size, fontSize: size * 0.58 }}
        aria-hidden
      >
        L
      </span>
      {withName && <span style={{ fontSize: Math.max(16, size * 0.62) }}>LearnLoop</span>}
    </span>
  );
}
