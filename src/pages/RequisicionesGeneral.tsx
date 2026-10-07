// Las requisiciones de todos los proyectos: la vista de Compras. Todo vive en
// pages/requisiciones/.
import RequisicionesLista from '@/pages/requisiciones/RequisicionesLista';

interface Props {
  onNavigate?: (view: string) => void;
  /** Una que se pidió abrir desde otra sección (Cotizaciones). */
  abrirRequisicionId?: number | null;
  onRequisicionAbierta?: () => void;
}

export default function RequisicionesGeneral({ onNavigate, abrirRequisicionId, onRequisicionAbierta }: Props) {
  return (
    <RequisicionesLista
      onNavigate={onNavigate}
      abrirAlEntrar={abrirRequisicionId}
      onAbiertaAlEntrar={onRequisicionAbierta}
    />
  );
}
