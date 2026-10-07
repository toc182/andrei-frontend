/**
 * ProjectInformacion Component
 * Displays project details and adendas as a full subview page
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { DesgloseView } from '@/components/desglose/DesgloseView';
import { AdendaTarjeta } from '@/components/project/AdendaTarjeta';
import { InfoRow } from '@/components/project/InfoRow';
import ProyectoDocumentos from './ProyectoDocumentos';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { diasConSigno, diasEntre, montoConSigno } from '@/lib/adendas';
import { formatDate } from '../../utils/dateUtils';
import { formatMoney } from '../../utils/formatters';
import type { Project, Adenda } from '@/types';

interface ProjectInformacionProps {
  project: Project;
  adendas: Adenda[];
  onOpenAdendaForm: () => void;
  onEditAdenda: (adenda: Adenda) => void;
  /** Pide borrarla; la confirmación la hace la pantalla de arriba. */
  onDeleteAdenda: (adenda: Adenda) => void;
  /** Abre la ventana de edición del proyecto. La dueña del proyecto es la
   *  pantalla de arriba, así que el botón solo avisa. */
  onEditProject: () => void;
}

const getEstadoBadge = (estado: string) => {
  const config: Record<string, { label: string; className: string }> = {
    planificacion: { label: 'Planificación', className: 'bg-slate-100 text-slate-600 border-slate-200 border' },
    en_progreso: { label: 'En Progreso', className: 'bg-info/10 text-info border-info/30 border' },
    en_curso: { label: 'En Curso', className: 'bg-info/10 text-info border-info/30 border' },
    completado: { label: 'Completado', className: 'bg-success/10 text-success border-success/30 border' },
    suspendido: { label: 'Suspendido', className: 'bg-error/10 text-error border-error/30 border' },
    pausado: { label: 'Pausado', className: 'bg-warning/10 text-warning border-warning/30 border' },
    cancelado: { label: 'Cancelado', className: 'bg-error/10 text-error border-error/30 border' },
  };
  const c = config[estado] || { label: estado, className: 'bg-slate-100 text-slate-600 border-slate-200 border' };
  return <Badge className={c.className}>{c.label}</Badge>;
};

function SinDato() {
  return <span className="text-muted-foreground">—</span>;
}

export default function ProjectInformacion({
  project,
  adendas,
  onOpenAdendaForm,
  onEditAdenda,
  onDeleteAdenda,
  onEditProject,
}: ProjectInformacionProps) {
  const [seccion, setSeccion] = useState<'datos' | 'desglose'>('datos');
  // Once opened, Desglose stays mounted (forceMount + hidden) so coming back to
  // the tab neither re-fetches nor flashes a skeleton, and unsaved edits survive
  // a trip to Datos. Deliberately NOT mounted up-front: users who never open
  // Desglose shouldn't pay for its fetch.
  const [desgloseMounted, setDesgloseMounted] = useState(false);
  const { user, hasPermission } = useAuth();
  const puedeVerDesglose =
    user?.rol === 'admin' || user?.rol === 'co-admin' || !!user?.permissions?.desglose_ver;
  // Render guard: desglose only when BOTH selected and permitted.
  const showDesglose = seccion === 'desglose' && puedeVerDesglose;
  // Días que las adendas aprobadas le sumaron a la terminación original.
  const extension =
    project.fecha_fin_estimada && project.fecha_fin_vigente
      ? diasEntre(project.fecha_fin_estimada, project.fecha_fin_vigente)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Información del Proyecto" />

      <Tabs
        value={showDesglose ? 'desglose' : 'datos'}
        onValueChange={(value) => {
          if (value === 'desglose') setDesgloseMounted(true);
          setSeccion(value as 'datos' | 'desglose');
        }}
      >
        <TabsList className="mb-6 w-full justify-center">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          {puedeVerDesglose && <TabsTrigger value="desglose">Desglose</TabsTrigger>}
        </TabsList>

        {/* Detalles y Adendas van lado a lado: los datos del proyecto son filas
            de etiqueta y valor, cortas, y solas ocupaban todo el ancho dejando
            medio monitor vacío. Debajo de lg vuelven a apilarse. */}
        <TabsContent
          value="datos"
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[5fr_7fr]"
        >
          {/* Project Details */}
          <Card>
            {/* El lápiz vive en la tarjeta que edita, no en la cabecera de la
                página: desde arriba no se veía qué era lo que iba a cambiar. */}
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Detalles</CardTitle>
              {hasPermission('proyectos_editar') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Editar los datos del proyecto"
                  onClick={onEditProject}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="Nombre:">{project.nombre}</InfoRow>

              {project.nombre_corto && (
                <InfoRow label="Nombre Corto:">{project.nombre_corto}</InfoRow>
              )}

              {project.cliente_nombre && (
                <InfoRow label="Cliente:">{project.cliente_nombre}</InfoRow>
              )}

              {/* Contratista y residente salen siempre, con raya si faltan: a
                  diferencia de las demás filas opcionales, aquí un vacío es un
                  dato pendiente que conviene ver. */}
              <InfoRow label="Contratista:">
                {project.contratista?.trim() || <SinDato />}
              </InfoRow>

              <InfoRow label="Ingeniero Residente:">
                {project.ingeniero_residente?.trim() || <SinDato />}
              </InfoRow>

              <InfoRow label="Estado:">{getEstadoBadge(project.estado)}</InfoRow>

              {project.fecha_inicio && (
                <InfoRow label="Fecha de Inicio:">{formatDate(project.fecha_inicio)}</InfoRow>
              )}

              {project.fecha_fin_estimada && (
                <InfoRow label="Fecha de Terminación:">{formatDate(project.fecha_fin_estimada)}</InfoRow>
              )}

              {/* Solo cuando una adenda aprobada la cambió (adenda_fecha_numero). */}
              {project.adenda_fecha_numero != null && project.fecha_fin_vigente && (
                <InfoRow label="Terminación Vigente:">
                  {formatDate(project.fecha_fin_vigente)}
                  {extension != null && (
                    <span className="text-muted-foreground">
                      {' '}({diasConSigno(extension)})
                    </span>
                  )}
                </InfoRow>
              )}

              {project.orden_proceder && (
                <InfoRow label="Orden de Proceder:">{formatDate(project.orden_proceder)}</InfoRow>
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

              {(project.adendas_con_monto ?? 0) > 0 && project.monto_vigente != null && (
                <>
                  <InfoRow label="Adendas Aprobadas:">{montoConSigno(project.monto_adendas ?? 0)}</InfoRow>
                  <InfoRow label="Monto Vigente:">
                    <span className="font-semibold">{formatMoney(project.monto_vigente)}</span>
                  </InfoRow>
                </>
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

          {/* Adendas y Documentos comparten la columna derecha. Van juntos en un
              contenedor para que se apilen entre ellos y no cada uno como celda
              suelta de la retícula: si no, Documentos se iría al lado de
              Detalles en cuanto Adendas midiera poco. */}
          <div className="space-y-6">
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
                    <AdendaTarjeta
                      key={adenda.id}
                      adenda={adenda}
                      onEditar={() => onEditAdenda(adenda)}
                      onEliminar={() => onDeleteAdenda(adenda)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ProyectoDocumentos projectId={project.id} />
          </div>

        </TabsContent>

        {/* forceMount keeps it alive once opened; Radix leaves a force-mounted
            panel visible, so the inactive tab must be hidden by hand.
            mt-0 drops TabsContent's default mt-2: stacked under TabsList's
            mb-6 it left the section title floating well below the tabs. */}
        {puedeVerDesglose && desgloseMounted && (
          <TabsContent value="desglose" forceMount className={cn('mt-0', !showDesglose && 'hidden')}>
            <DesgloseView proyectoId={project.id} proyectoNombre={project.nombre} />
          </TabsContent>
        )}
      </Tabs>

    </div>
  );
}
