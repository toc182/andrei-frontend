import { type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const hasDivider = size !== "confirm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogWidths[size], "max-h-[90vh] overflow-hidden p-0")}>
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader
            className={cn(
              "space-y-1 flex-shrink-0 px-6 pt-6",
              hasDivider && "border-b border-border pb-4"
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
          <div className="min-h-0 flex-1">
            <ScrollArea className="h-full max-h-[calc(90vh-10rem)]">
              <div className="px-6 py-4">{children}</div>
            </ScrollArea>
          </div>
          {footer && (
            <DialogFooter
              className={cn(
                "gap-2 sm:justify-between flex-shrink-0 px-6 pb-6",
                hasDivider && "border-t border-border pt-4"
              )}
            >
              {footer}
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
