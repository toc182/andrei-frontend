import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconVariant = "neutral" | "warning" | "error" | "info";

interface FullPageStateProps {
  code?: string;
  icon?: ReactNode;
  iconVariant?: IconVariant;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
}

const iconCircleMap: Record<IconVariant, string> = {
  neutral: "bg-slate-100 text-slate-500",
  warning: "bg-warning/10 text-warning",
  error:   "bg-error/10 text-error",
  info:    "bg-info/10 text-info",
};

export function FullPageState({
  code,
  icon,
  iconVariant = "neutral",
  title,
  description,
  actions,
  meta,
  footer,
}: FullPageStateProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3.5 px-6 py-12 text-center">
      {code && (
        <div className="font-heading text-5xl font-bold tracking-tight text-navy leading-none">
          {code}
        </div>
      )}
      {icon && !code && (
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-full", iconCircleMap[iconVariant])}>
          {icon}
        </div>
      )}
      <h1 className="font-heading text-2xl font-semibold text-foreground max-w-md mt-1">
        {title}
      </h1>
      {description && (
        <p className="text-sm text-slate-600 max-w-md leading-relaxed">{description}</p>
      )}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>}
      {meta && <div className="mt-2 font-mono text-xs text-slate-400">{meta}</div>}
      {footer}
    </div>
  );
}
