import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: ReactNode;
  /** Sits inline, immediately after the title — for a control that belongs to
   *  the heading itself (e.g. an options menu), not to the section's content.
   *  Keep it icon-sized: anything taller inflates the header row. */
  titleAction?: ReactNode;
  overline?: string;
}

export function SectionHeader({ title, count, action, titleAction, overline }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2 border-l-2 border-navy pl-3">
        {overline && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal">
            {overline}
          </p>
        )}
        <h2 className="text-base font-semibold leading-tight text-foreground">
          {title}
        </h2>
        {typeof count === "number" && (
          <Badge variant="secondary" className="bg-slate-100 text-slate-600">
            {count}
          </Badge>
        )}
        {titleAction}
      </div>
      {action}
    </div>
  );
}
