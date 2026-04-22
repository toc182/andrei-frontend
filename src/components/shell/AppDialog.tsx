import { type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DialogSize = "confirm" | "simple" | "standard" | "complex" | "detail";

interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: DialogSize;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

const dialogWidths: Record<DialogSize, string> = {
  confirm:  "sm:max-w-md",
  simple:   "sm:max-w-lg",
  standard: "sm:max-w-2xl",
  complex:  "sm:max-w-4xl",
  detail:   "sm:max-w-4xl",
};

export function AppDialog({
  open,
  onOpenChange,
  size = "simple",
  title,
  description,
  children,
  footer,
}: AppDialogProps) {
  const hasDivider = size === "standard" || size === "complex" || size === "detail";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogWidths[size], "max-h-[90vh] overflow-y-auto")}>
        <DialogHeader
          className={cn(
            "space-y-1",
            hasDivider && "-mx-6 border-b border-border px-6 pb-4"
          )}
        >
          <DialogTitle className="text-lg font-semibold text-foreground">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="py-2">{children}</div>
        {footer && (
          <DialogFooter
            className={cn(
              "gap-2 sm:justify-between",
              hasDivider && "-mx-6 border-t border-border px-6 pt-4"
            )}
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
