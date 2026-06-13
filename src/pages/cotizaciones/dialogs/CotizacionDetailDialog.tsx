// Detail of a cotización (request) with the supplier comparison table.
// Mark one oferta elegida, add ofertas, edit/delete the cotización, and
// open an oferta for its files. Fetches its own detail and refreshes the
// page lists via onChanged.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Check, Paperclip } from 'lucide-react';
import { AppDialog } from '@/components/shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/services/api';
import { formatMoney } from '@/utils/formatters';
import type { CotizacionDetalle, CotizacionOferta } from '@/types/api';
import { formatFecha, proyectoLabel } from '../shared';
import { TipoBadge } from '../components/TipoBadge';
import { CotizacionFormDialog } from './CotizacionFormDialog';
import { OfertaFormDialog } from './OfertaFormDialog';
import { OfertaDetailDialog, type OfertaDetailData } from './OfertaDetailDialog';

interface ProjectOption {
  id: number;
  nombre: string;
  nombre_corto?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cotizacionId: number | null;
  projects: ProjectOption[];
  onChanged: () => void;
}

export function CotizacionDetailDialog({
  open,
  onOpenChange,
  cotizacionId,
  projects,
  onChanged,
}: Props) {
  const [detalle, setDetalle] = useState<CotizacionDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addOfertaOpen, setAddOfertaOpen] = useState(false);
  const [ofertaDetail, setOfertaDetail] = useState<OfertaDetailData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!cotizacionId) return;
    setLoading(true);
    try {
      const res = await api.get(`/cotizaciones/${cotizacionId}`);
      setDetalle(res.data.data);
    } catch (err) {
      console.error('Error loading cotización:', err);
    } finally {
      setLoading(false);
    }
  }, [cotizacionId]);

  useEffect(() => {
    if (open && cotizacionId) load();
  }, [open, cotizacionId, load]);

  // Refresh both this dialog's detail and the page lists.
  const refreshAll = () => {
    load();
    onChanged();
  };

  const toggleEleccion = async (oferta: CotizacionOferta) => {
    setTogglingId(oferta.id);
    try {
      await api.put(`/cotizaciones/ofertas/${oferta.id}/eleccion`, {
        elegida: !oferta.elegida,
      });
      refreshAll();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!detalle) return;
    setDeleting(true);
    try {
      await api.delete(`/cotizaciones/${detalle.id}`);
      setConfirmDelete(false);
      onOpenChange(false);
      onChanged();
    } finally {
      setDeleting(false);
    }
  };

  const openOferta = (oferta: CotizacionOferta) => {
    if (!detalle) return;
    setOfertaDetail({
      id: oferta.id,
      cotizacion_id: detalle.id,
      proveedor: oferta.proveedor,
      monto: oferta.monto,
      nota: oferta.nota,
      created_at: oferta.created_at,
      agregado_por_nombre: oferta.creado_por_nombre,
      descripcion: detalle.descripcion,
      tipo: detalle.tipo,
      proyecto_nombre: detalle.proyecto_nombre,
      ambito: detalle.ambito,
    });
  };

  return (
    <>
      <AppDialog
        open={open}
        onOpenChange={onOpenChange}
        size="detail"
        title={detalle?.descripcion ?? 'Cotización'}
        footer={
          <>
            <Button
              variant="ghost"
              className="text-error hover:text-error"
              onClick={() => setConfirmDelete(true)}
              disabled={!detalle}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)} disabled={!detalle}>
                Editar
              </Button>
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </div>
          </>
        }
      >
        {loading || !detalle ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <TipoBadge tipo={detalle.tipo} />
              <span>
                Proyecto:{' '}
                <span className="font-medium text-foreground">
                  {proyectoLabel(detalle.proyecto_nombre, detalle.ambito)}
                </span>
              </span>
              <span>
                Fecha:{' '}
                <span className="font-medium text-foreground">
                  {formatFecha(detalle.created_at)}
                </span>
              </span>
              <span>
                Pedido por:{' '}
                <span className="font-medium text-foreground">
                  {detalle.pedido_por_nombre || '—'}
                </span>
              </span>
            </div>

            {detalle.descripcion_larga && (
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Descripción
                </div>
                <p className="text-sm leading-relaxed">{detalle.descripcion_larga}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="border-l-2 border-l-navy pl-2 text-sm font-bold text-navy">
                Cotizaciones recibidas ({detalle.ofertas.length})
              </h3>
              <Button variant="outline" size="sm" onClick={() => setAddOfertaOpen(true)}>
                <Plus className="mr-1 h-3 w-3" />
                Agregar oferta
              </Button>
            </div>

            {detalle.ofertas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                Aún no hay ofertas. Agrega la primera.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                      <TableHead className="px-3 py-2">Proveedor</TableHead>
                      <TableHead className="px-3 py-2 text-right">Precio</TableHead>
                      <TableHead className="px-3 py-2">Nota</TableHead>
                      <TableHead className="px-3 py-2 text-center">Archivos</TableHead>
                      <TableHead className="px-3 py-2"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.ofertas.map((o) => (
                      <TableRow
                        key={o.id}
                        className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60 ${o.elegida ? 'bg-success/5' : ''}`}
                        onClick={() => openOferta(o)}
                      >
                        <TableCell className="px-3 py-2.5 font-semibold">
                          <span className="inline-flex items-center gap-2">
                            {o.proveedor}
                            {o.elegida && (
                              <Badge className="border border-success/30 bg-success/10 text-success">
                                <Check className="mr-1 h-3 w-3" />
                                Elegida
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-700">
                          {formatMoney(o.monto)}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground">
                          {o.nota || '—'}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-navy">
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                            {o.archivos_count}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right">
                          <Button
                            variant={o.elegida ? 'ghost' : 'outline'}
                            size="sm"
                            disabled={togglingId === o.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEleccion(o);
                            }}
                          >
                            {togglingId === o.id && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            {o.elegida ? 'Quitar' : 'Elegir'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </AppDialog>

      {detalle && (
        <>
          <CotizacionFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            mode="edit"
            initial={detalle}
            projects={projects}
            onSaved={() => {
              setEditOpen(false);
              refreshAll();
            }}
          />
          <OfertaFormDialog
            open={addOfertaOpen}
            onOpenChange={setAddOfertaOpen}
            mode="create"
            cotizacionId={detalle.id}
            onSaved={() => {
              setAddOfertaOpen(false);
              refreshAll();
            }}
          />
        </>
      )}

      <OfertaDetailDialog
        open={!!ofertaDetail}
        onOpenChange={(o) => !o && setOfertaDetail(null)}
        oferta={ofertaDetail}
        onChanged={refreshAll}
      />

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la solicitud y sus ofertas dejarán de mostrarse. Esta acción
              no se puede deshacer desde la app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
