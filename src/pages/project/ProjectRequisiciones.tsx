// Las requisiciones de un proyecto. Todo vive en pages/requisiciones/: la misma
// lista sirve para un proyecto y para todos.
import RequisicionesLista from '@/pages/requisiciones/RequisicionesLista';

interface Props {
  projectId: number;
  projectName?: string;
  onNavigate?: (view: string) => void;
}

export default function ProjectRequisiciones({ projectId, projectName, onNavigate }: Props) {
  return (
    <RequisicionesLista
      // Otro proyecto es otra pantalla: nada del anterior se asoma mientras carga.
      key={projectId}
      proyectoId={projectId}
      proyectoNombre={projectName}
      onNavigate={onNavigate}
    />
  );
}
