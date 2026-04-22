import { type ReactNode, type ElementType } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function StateShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      {children}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <StateShell>
      <div className="rounded-full bg-slate-50 p-3">
        <Icon className="h-6 w-6 text-slate-400" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </StateShell>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Algo sali\u00f3 mal",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <StateShell>
      <div className="rounded-full bg-error/10 p-3">
        <AlertTriangle className="h-6 w-6 text-error" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
      )}
    </StateShell>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="border-b border-slate-100 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c} className="px-4 py-3">
              <Skeleton className={cn("h-4", c === 0 ? "w-[60%]" : "w-[40%]")} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-border border-l-4 border-l-slate-200 bg-card p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}
