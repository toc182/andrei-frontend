import { cn } from "@/lib/utils";
import { getInitials } from "@/utils/formatters";

interface Aprobador {
  nombre: string;
  estado: "aprobado" | "pendiente" | "rechazado";
}

interface ApprovalPillBarProps {
  aprobadores: Aprobador[];
}

export function ApprovalPillBar({ aprobadores }: ApprovalPillBarProps) {
  if (aprobadores.length === 0) return null;

  return (
    <div className="inline-flex h-[22px] overflow-hidden rounded-md border border-border">
      {aprobadores.map((a) => (
        <div
          key={a.nombre}
          className={cn(
            "inline-flex items-center justify-center border-r border-white/50 px-2.5 text-[10.5px] font-semibold last:border-r-0",
            a.estado === "aprobado"  && "bg-success text-white",
            a.estado === "pendiente" && "bg-warning/12 text-warning",
            a.estado === "rechazado" && "bg-error text-white"
          )}
          title={`${a.nombre}: ${a.estado}`}
        >
          {getInitials(a.nombre)}
        </div>
      ))}
    </div>
  );
}
