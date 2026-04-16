interface Props {
  value: number | string | null | undefined;
  width?: number;
}

export default function AvanceBar({ value, width = 40 }: Props) {
  const pct = value != null ? Number(value) : 0;
  if (!pct && pct !== 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="rounded-full bg-border overflow-hidden" style={{ width, height: 4 }}>
        <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{pct.toFixed(0)}%</span>
    </div>
  );
}
