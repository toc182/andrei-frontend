import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast bg-card text-foreground border-border border border-l-[3px]",
          description: "text-slate-700",
          actionButton: "bg-navy text-white",
          cancelButton: "bg-slate-100 text-slate-700",
          // Variant accents (left border + icon color). Matches the
          // FRONTEND_CONVENTIONS §15 left-accent language.
          success: "!border-l-success [&_[data-icon]]:text-success",
          error: "!border-l-error [&_[data-icon]]:text-error",
          warning: "!border-l-warning [&_[data-icon]]:text-warning",
          info: "!border-l-info [&_[data-icon]]:text-info",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
