import { type ElementType } from "react";
import { cn } from "@/lib/utils";

type AccentColor = "navy" | "teal" | "warning" | "error" | "success" | "info";
type TrendDirection = "up" | "down" | "flat";

interface TrendData {
  value: string;
  direction: TrendDirection;
  context?: string;
}

interface StatCardProps {
  label: string;
  value: string;
  icon?: ElementType;
  trend?: TrendData;
  accent?: AccentColor;
  href?: string;
  onClick?: () => void;
}

const accentMap: Record<AccentColor, string> = {
  navy:    "border-l-navy",
  teal:    "border-l-teal",
  warning: "border-l-warning",
  error:   "border-l-error",
  success: "border-l-success",
  info:    "border-l-info",
};

const trendColor: Record<TrendDirection, string> = {
  up:   "text-success",
  down: "text-error",
  flat: "text-slate-500",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "navy",
  href,
  onClick,
}: StatCardProps) {
  const isClickable = !!href || !!onClick;
  const Wrapper = href ? "a" : "div";
  const clickProps = href
    ? { href }
    : onClick
      ? { onClick, role: "button" as const, tabIndex: 0 }
      : {};

  return (
    <Wrapper
      {...clickProps}
      className={cn(
        "block rounded-lg border border-border border-l-4 bg-card p-5",
        accentMap[accent],
        isClickable &&
          "cursor-pointer transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2"
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 text-slate-300" aria-hidden />}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {trend && (
        <p className={cn("mt-2 text-xs font-medium", trendColor[trend.direction])}>
          {trend.direction === "up" && "\u25B2 "}
          {trend.direction === "down" && "\u25BC "}
          {trend.value}
          {trend.context && (
            <span className="ml-1 font-normal text-muted-foreground">
              {trend.context}
            </span>
          )}
        </p>
      )}
    </Wrapper>
  );
}
