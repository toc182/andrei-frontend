// Project selector shown before creating a new solicitud in the global view.
// Only used in SolicitudesPagoGeneral.tsx — the project view doesn't need
// this because its project is already known.
//
// Lifted out of SolicitudesPagoGeneral.tsx during the refactor of issue #26.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Seleccionar Proyecto</DialogTitle>
          <DialogDescription>
            Selecciona el proyecto para la nueva solicitud de pago
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
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
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs flex items-center gap-2">
                Este proyecto no tiene aprobadores configurados. Configure los
                aprobadores en la seccion Miembros del proyecto.
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => onNavigateToMiembros(selectedProjectId)}
                >
                  Ir a Miembros
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
