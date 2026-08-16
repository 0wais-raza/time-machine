export function PanelHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--holo-cyan)]">
          <span className="led-dot size-1.5" style={{ color: "var(--holo-cyan)" }} />
          {eyebrow}
        </div>
        <h1 className="mt-1.5 text-[26px] font-bold leading-none tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-3 h-px w-full max-w-[420px] bg-gradient-to-r from-[oklch(0.85_0.17_200/0.4)] via-[oklch(0.85_0.17_200/0.08)] to-transparent" />
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
