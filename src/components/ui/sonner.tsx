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
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
