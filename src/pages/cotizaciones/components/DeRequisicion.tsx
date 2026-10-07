// «· REQ-SI-176» al lado de la descripción: la entrada viene de esa
// requisición (mock 19, aprobado el 2026-10-05).

export function DeRequisicion({ numero }: { numero: string | null | undefined }) {
  if (!numero) return null;
  return <span className="font-normal text-muted-foreground"> · {numero}</span>;
}
