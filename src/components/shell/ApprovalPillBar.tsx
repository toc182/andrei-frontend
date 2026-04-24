import { cn } from "@/lib/utils";
import { getInitials } from "@/utils/formatters";

interface Aprobador {
  nombre: string;
  estado: string;
}

interface ApprovalPillBarProps {
  aprobadores: Aprobador[];
}

export function ApprovalPillBar({ aprobadores }: ApprovalPillBarProps) {
  if (aprobadores.length === 0) return null;

  return (
    <div className="inline-flex h-[26px] w-[5rem] overflow-hidden rounded-md border border-border">
      {aprobadores.map((a) => (
        <div
          key={a.nombre}
          className={cn(
            "inline-flex flex-1 items-center justify-center border-r border-white/50 text-[9px] leading-none font-semibold last:border-r-0",
            a.estado === "aprobado"  && "bg-success text-white",
            a.estado === "pendiente" && "bg-navy/10 text-navy",
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
