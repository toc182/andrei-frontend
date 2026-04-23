// Stack of small avatars showing each approver's status for a solicitud.
// Lifted out of SolicitudesPagoGeneral.tsx and ProjectSolicitudesPago.tsx
// during the refactor of issue #26.

function getInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nombre.substring(0, 2).toUpperCase();
}

const COLOR_MAP: Record<string, string> = {
  aprobado: 'bg-success text-white',
  pendiente: 'bg-warning/12 text-warning border border-warning/30',
  rechazado: 'bg-error text-white',
};

interface AprobadoresAvatarsProps {
  aprobadores: { nombre: string; estado: string }[];
}

export function AprobadoresAvatars({ aprobadores }: AprobadoresAvatarsProps) {
  return (
    <div className="flex items-center -space-x-1">
      {aprobadores.map((a, i) => (
        <div
          key={i}
          title={`${a.nombre}: ${a.estado}`}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${COLOR_MAP[a.estado] || COLOR_MAP['pendiente']}`}
        >
          {getInitials(a.nombre)}
        </div>
      ))}
    </div>
  );
}
