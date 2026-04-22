import { type ReactNode, type ElementType } from "react";
import { cn } from "@/lib/utils";
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantMap: Record<AlertVariant, { border: string; text: string; Icon: ElementType }> = {
  info:    { border: "border-l-info",    text: "text-info",    Icon: Info },
  success: { border: "border-l-success", text: "text-success", Icon: CheckCircle2 },
  warning: { border: "border-l-warning", text: "text-warning", Icon: AlertTriangle },
  error:   { border: "border-l-error",   text: "text-error",   Icon: XCircle },
};

export function Alert({
  variant = "info",
  title,
  description,
  actions,
  dismissible,
  onDismiss,
  className,
}: AlertProps) {
  const { border, text, Icon } = variantMap[variant];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-border border-l-[3px] bg-card px-3.5 py-3",
        border,
        className
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", text)} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-slate-700 leading-relaxed">{description}</p>
        )}
        {actions && <div className="mt-2 flex gap-2">{actions}</div>}
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Cerrar"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
