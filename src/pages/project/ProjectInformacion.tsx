/**
 * ProjectInformacion Component
 * Displays project details and adendas as a full subview page
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { formatMoney } from '../../utils/formatters';
import type { Project, Adenda } from '@/types';

interface ProjectInformacionProps {
  project: Project;
  adendas: Adenda[];
  onOpenAdendaForm: () => void;
  onEditAdenda: (adenda: Adenda) => void;
  onDeleteAdenda: (adendaId: number) => void;
}

const getEstadoBadge = (estado: string) => {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    planificacion: { label: 'Planificación', variant: 'secondary' },
    en_progreso: { label: 'En Progreso', variant: 'default' },
    completado: { label: 'Completado', variant: 'outline' },
    suspendido: { label: 'Suspendido', variant: 'destructive' },
  };
  const c = config[estado] || { label: estado, variant: 'secondary' as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
};

const getAdendaStatusBadge = (estado: string) => {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    en_proceso: { label: 'En Proceso', variant: 'secondary' },
    aprobada: { label: 'Aprobada', variant: 'default' },
    rechazada: { label: 'Rechazada', variant: 'destructive' },
  };
  const c = config[estado] || { label: estado, variant: 'secondary' as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
};

const getAdendaTypeText = (tipo: string) => {
  const types: Record<string, string> = {
    tiempo: 'Extensión de Tiempo',
    costo: 'Modificación de Costo',
    mixta: 'Tiempo y Costo',
  };
  return types[tipo] || tipo;
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export default function ProjectInformacion({
  project,
  adendas,
  onOpenAdendaForm,
  onEditAdenda,
  onDeleteAdenda,
}: ProjectInformacionProps) {
  return (
    <div className="space-y-6">
      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Proyecto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow label="Nombre:">{project.nombre}</InfoRow>

          {project.nombre_corto && (
            <InfoRow label="Nombre Corto:">{project.nombre_corto}</InfoRow>
          )}

          {project.codigo_proyecto && (
            <InfoRow label="Código:">{project.codigo_proyecto}</InfoRow>
          )}

          {project.cliente_nombre && (
            <InfoRow label="Cliente:">{project.cliente_nombre}</InfoRow>
          )}

          <InfoRow label="Estado:">{getEstadoBadge(project.estado)}</InfoRow>

          {project.fecha_inicio && (
            <InfoRow label="Fecha de Inicio:">{formatDate(project.fecha_inicio)}</InfoRow>
          )}

          {project.fecha_fin_estimada && (
            <InfoRow label="Fecha de Terminación:">{formatDate(project.fecha_fin_estimada)}</InfoRow>
          )}

          {project.presupuesto_base && (
            <InfoRow label="Presupuesto Base:">{formatMoney(project.presupuesto_base)}</InfoRow>
          )}

          {project.itbms && (
            <InfoRow label="ITBMS (7%):">{formatMoney(project.itbms)}</InfoRow>
          )}

          {project.monto_total && (
            <InfoRow label="Monto Total:">{formatMoney(project.monto_total)}</InfoRow>
          )}

          {project.contrato && (
            <InfoRow label="Número de Contrato:">{project.contrato}</InfoRow>
          )}

          {project.acto_publico && (
            <InfoRow label="Acto Público:">{project.acto_publico}</InfoRow>
          )}

          {project.datos_adicionales?.observaciones && (
            <InfoRow label="Observaciones:">{project.datos_adicionales.observaciones}</InfoRow>
          )}
        </CardContent>
      </Card>

      {/* Adendas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Adendas</CardTitle>
          <Button size="sm" variant="outline" onClick={onOpenAdendaForm}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent>
          {adendas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay adendas registradas.</p>
          ) : (
            <div className="space-y-4">
              {adendas.map((adenda) => (
                <div key={adenda.id} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        Adenda #{adenda.numero_adenda}
                      </span>
                      {getAdendaStatusBadge(adenda.estado)}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onEditAdenda(adenda)}
                        title="Editar adenda"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDeleteAdenda(adenda.id)}
                        title="Eliminar adenda"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <InfoRow label="Tipo:">{getAdendaTypeText(adenda.tipo)}</InfoRow>

                  {adenda.nueva_fecha_fin && (
                    <InfoRow label="Nueva Fecha:">
                      {formatDate(adenda.nueva_fecha_fin)}
                      {adenda.dias_extension && (
                        <span className="text-muted-foreground">
                          {' '}(+{adenda.dias_extension} días)
                        </span>
                      )}
                    </InfoRow>
                  )}

                  {adenda.nuevo_monto && (
                    <InfoRow label="Nuevo Monto:">{formatMoney(adenda.nuevo_monto)}</InfoRow>
                  )}

                  {adenda.monto_adicional && (
                    <InfoRow label="Monto Adicional:">{formatMoney(adenda.monto_adicional)}</InfoRow>
                  )}

                  {adenda.observaciones && (
                    <InfoRow label="Observaciones:">{adenda.observaciones}</InfoRow>
                  )}

                  <InfoRow label="Solicitada:">
                    {formatDate(adenda.fecha_solicitud)}
                    {adenda.fecha_aprobacion && (
                      <span className="text-muted-foreground">
                        {' | Aprobada: '}
                        {formatDate(adenda.fecha_aprobacion)}
                      </span>
                    )}
                  </InfoRow>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
