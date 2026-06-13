// Detail of one supplier oferta: key facts, notes, files, and a link back
// to its parent cotización. Opened from the "Por proveedor" tab and from
// inside the cotización detail.

import { useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { AppDialog } from '@/components/shell';
import { Button, buttonVariants } from '@/components/ui/button';
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
import type { CotizacionOferta, CotizacionAmbito } from '@/types/api';
import { formatFecha, proyectoLabel } from '../shared';
import { TipoBadge } from '../components/TipoBadge';
import { CotizacionArchivos } from '../components/CotizacionArchivos';
import { OfertaFormDialog } from './OfertaFormDialog';

export interface OfertaDetailData {
  id: number;
  cotizacion_id: number;
  proveedor: string;
  monto: string | null;
  nota: string | null;
  created_at: string;
  agregado_por_nombre: string | null;
  // parent context
  descripcion: string;
  tipo: import('@/types/api').CotizacionTipo | null;
  proyecto_nombre: string | null;
  ambito: CotizacionAmbito | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oferta: OfertaDetailData | null;
  onChanged: () => void; // refresh page lists
  onOpenParent?: (cotizacionId: number) => void;
}

export function OfertaDetailDialog({
  open,
  onOpenChange,
  oferta,
  onChanged,
  onOpenParent,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!oferta) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/cotizaciones/ofertas/${oferta.id}`);
      setConfirmDelete(false);
      onOpenChange(false);
      onChanged();
    } finally {
      setDeleting(false);
    }
  };

  // For the edit form (CotizacionOferta shape).
  const ofertaForEdit: CotizacionOferta = {
    id: oferta.id,
    proveedor: oferta.proveedor,
    monto: oferta.monto,
    nota: oferta.nota,
    elegida: false,
    created_at: oferta.created_at,
    creado_por_nombre: oferta.agregado_por_nombre,
    archivos_count: 0,
  };

  return (
    <>
      <AppDialog
        open={open}
        onOpenChange={onOpenChange}
        size="standard"
        title={oferta.proveedor}
        footer={
          <>
            <Button
              variant="ghost"
              className="text-error hover:text-error"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{oferta.descripcion}</span>
            <TipoBadge tipo={oferta.tipo} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 sm:grid-cols-4">
            <div>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Precio
              </div>
              <div className="font-semibold tabular-nums text-slate-700">
                {formatMoney(oferta.monto)}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Fecha
              </div>
              <div className="font-semibold">{formatFecha(oferta.created_at)}</div>
            </div>
            <div>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Proyecto
              </div>
              <div className="font-semibold">{proyectoLabel(oferta.proyecto_nombre, oferta.ambito)}</div>
            </div>
            <div>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Agregado por
              </div>
              <div className="font-semibold">{oferta.agregado_por_nombre || '—'}</div>
            </div>
          </div>

          {onOpenParent && (
            <div className="text-sm">
              <button
                type="button"
                className="font-semibold text-navy hover:underline"
                onClick={() => onOpenParent(oferta.cotizacion_id)}
              >
                Ver solicitud completa
              </button>
            </div>
          )}

          {oferta.nota && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Notas
              </div>
              <p className="text-sm leading-relaxed">{oferta.nota}</p>
            </div>
          )}

          <CotizacionArchivos ofertaId={oferta.id} onChanged={onChanged} />
        </div>
      </AppDialog>

      <OfertaFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        cotizacionId={oferta.cotizacion_id}
        oferta={ofertaForEdit}
        onSaved={() => {
          setEditOpen(false);
          onChanged();
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la oferta de {oferta.proveedor}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará de la cotización. Esta acción no se puede deshacer desde la app.
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
