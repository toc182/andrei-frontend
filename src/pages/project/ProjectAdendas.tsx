/**
 * ProjectAdendas Component
 * Dedicated tab for managing project adendas (amendments)
 * Features: Create, Read, Update, Delete operations with role-based access
 */

import { useAuth } from '../../context/AuthContext';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatDate } from '../../utils/dateUtils';
import { formatMoney } from '../../utils/formatters';
import type { Adenda } from '@/types';
import { SectionHeader } from '@/components/shell/SectionHeader';

interface ProjectAdendasProps {
  projectId: number;
  adendas: Adenda[];
  onOpenForm: () => void;
  onEditAdenda: (adenda: Adenda) => void;
  onDeleteAdenda: (adendaId: number) => void;
}

export default function ProjectAdendas({
  projectId,
  adendas,
  onOpenForm,
  onEditAdenda,
  onDeleteAdenda,
}: ProjectAdendasProps) {
  const { user } = useAuth();
  const canManage = !!user;

  const getAdendaStatusBadgeVariant = (estado: string): string => {
    const variants: Record<string, string> = {
      en_proceso: 'secondary',
      aprobada: 'default',
      rechazada: 'destructive',
    };
    return variants[estado] || 'secondary';
  };

  const getAdendaStatusText = (estado: string): string => {
    const statusTexts: Record<string, string> = {
      en_proceso: 'En Proceso',
      aprobada: 'Aprobada',
      rechazada: 'Rechazada',
    };
    return statusTexts[estado] || estado;
  };

  const getAdendaTypeText = (tipo: string): string => {
    const typeTexts: Record<string, string> = {
      tiempo: 'Extensión de Tiempo',
      costo: 'Modificación de Costo',
      mixta: 'Tiempo y Costo',
    };
    return typeTexts[tipo] || tipo;
  };

  // Empty State
  if (adendas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No hay adendas registradas
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Este proyecto aún no tiene adendas asociadas
          </p>
          {canManage && (
            <Button onClick={onOpenForm}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Primera Adenda
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Adendas List View
  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <SectionHeader
        title="Adendas del Proyecto"
        count={adendas.length}
        action={
          canManage ? (
            <Button onClick={onOpenForm} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Adenda
            </Button>
          ) : undefined
        }
      />

      {/* Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {adendas.map((adenda) => (
          <Card key={adenda.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold">
                    Adenda #{adenda.numero_adenda}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {getAdendaTypeText(adenda.tipo)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={getAdendaStatusBadgeVariant(adenda.estado) as any}
                  >
                    {getAdendaStatusText(adenda.estado)}
                  </Badge>
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onEditAdenda(adenda)}
                        title="Editar adenda"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:text-destructive"
                        onClick={() => onDeleteAdenda(adenda.id)}
                        title="Eliminar adenda"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {/* Date Information */}
              {adenda.nueva_fecha_fin && (
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <span className="text-muted-foreground">Nueva Fecha:</span>
                  <span className="font-medium">
                    {formatDate(adenda.nueva_fecha_fin)}
                    {adenda.dias_extension && (
                      <span className="text-muted-foreground ml-1">
                        (+{adenda.dias_extension} días)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Money Information */}
              {adenda.nuevo_monto && (
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <span className="text-muted-foreground">Nuevo Monto:</span>
                  <span className="font-medium">
                    {formatMoney(adenda.nuevo_monto)}
                  </span>
                </div>
              )}

              {adenda.monto_adicional && (
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <span className="text-muted-foreground">
                    Monto Adicional:
                  </span>
                  <span className="font-medium">
                    {formatMoney(adenda.monto_adicional)}
                  </span>
                </div>
              )}

              {/* Observations */}
              {adenda.observaciones && (
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <span className="text-muted-foreground">Observaciones:</span>
                  <span className="text-sm">{adenda.observaciones}</span>
                </div>
              )}

              {/* Request and Approval Dates */}
              <div className="grid grid-cols-[140px_1fr] gap-2 pt-2 border-t">
                <span className="text-muted-foreground">Solicitada:</span>
                <span className="text-sm">
                  {formatDate(adenda.fecha_solicitud)}
                  {adenda.fecha_aprobacion && (
                    <span className="text-muted-foreground">
                      {' | Aprobada: '}
                      {formatDate(adenda.fecha_aprobacion)}
                    </span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
