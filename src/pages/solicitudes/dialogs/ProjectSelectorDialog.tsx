// Project selector shown before creating a new solicitud in the global view.
// Only used in SolicitudesPagoGeneral.tsx — the project view doesn't need
// this because its project is already known.
//
// Lifted out of SolicitudesPagoGeneral.tsx during the refactor of issue #26.

import { AppDialog } from '@/components/shell/AppDialog';
import { Alert as ShellAlert } from '@/components/shell/Alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProjectOption } from '../types';

interface ProjectSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proyectos: ProjectOption[];
  onProjectSelected: (projectId: string) => void;
  checkingApprovers: boolean;
  selectorNoApprovers: boolean;
  selectedProjectId: number | null;
  onNavigateToMiembros: (projectId: number) => void;
}

export function ProjectSelectorDialog({
  open,
  onOpenChange,
  proyectos,
  onProjectSelected,
  checkingApprovers,
  selectorNoApprovers,
  selectedProjectId,
  onNavigateToMiembros,
}: ProjectSelectorDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="confirm"
      title="Seleccionar Proyecto"
      description="Selecciona el proyecto para la nueva solicitud de pago"
    >
      <div className="space-y-3">
        <Select
          onValueChange={onProjectSelected}
          disabled={checkingApprovers}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                checkingApprovers
                  ? 'Verificando...'
                  : 'Selecciona un proyecto'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.nombre_corto || p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectorNoApprovers && selectedProjectId && (
          <ShellAlert
            variant="warning"
            title="Este proyecto no tiene aprobadores configurados."
            description="Configure los aprobadores en la seccion Miembros del proyecto."
            actions={
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => onNavigateToMiembros(selectedProjectId)}
              >
                Ir a Miembros
              </Button>
            }
          />
        )}
      </div>
    </AppDialog>
  );
}
