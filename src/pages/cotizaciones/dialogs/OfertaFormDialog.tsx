// Add a supplier oferta to an existing cotización, or edit one. On add,
// optional files upload after the oferta is created.

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AppDialog } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api';
import type { CotizacionOferta } from '@/types/api';
import { PendingFilesPicker } from '../components/PendingFilesPicker';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  cotizacionId: number;
  oferta?: CotizacionOferta | null;
  onSaved: () => void;
}

export function OfertaFormDialog({
  open,
  onOpenChange,
  mode,
  cotizacionId,
  oferta,
  onSaved,
}: Props) {
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setPendingFiles([]);
    if (mode === 'edit' && oferta) {
      setProveedor(oferta.proveedor);
      setMonto(oferta.monto != null ? String(oferta.monto) : '');
      setNota(oferta.nota ?? '');
    } else {
      setProveedor('');
      setMonto('');
      setNota('');
    }
  }, [open, mode, oferta]);

  const submit = async () => {
    setError('');
    if (!proveedor.trim()) {
      setError('El proveedor es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const body = {
        proveedor: proveedor.trim(),
        monto: monto ? Number(monto) : null,
        nota: nota.trim() || null,
      };
      if (mode === 'edit' && oferta) {
        await api.put(`/cotizaciones/ofertas/${oferta.id}`, body);
      } else {
        const res = await api.post(`/cotizaciones/${cotizacionId}/ofertas`, body);
        const ofertaId: number | undefined = res.data?.data?.id;
        if (ofertaId && pendingFiles.length > 0) {
          const formData = new FormData();
          pendingFiles.forEach((f) => formData.append('archivos', f));
          try {
            await api.post(`/cotizaciones/ofertas/${ofertaId}/archivos`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (uploadErr) {
            console.error('Error subiendo archivos:', uploadErr);
            setError(
              'La oferta se guardó, pero algunos archivos no se subieron. Puedes agregarlos desde el detalle.',
            );
          }
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; message?: string } } };
      setError(
        e.response?.data?.error || e.response?.data?.message || 'Error al guardar',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="simple"
      title={mode === 'edit' ? 'Editar oferta' : 'Agregar oferta de proveedor'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button form="oferta-form" type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'edit' ? 'Guardar' : 'Agregar'}
          </Button>
        </>
      }
    >
      <form
        id="oferta-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <Label>Proveedor</Label>
          <Input
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Nombre del proveedor"
            maxLength={255}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>
              Precio (B/.){' '}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label>
              Nota{' '}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: entrega incluida"
            />
          </div>
        </div>
        {mode === 'create' && (
          <div className="space-y-1">
            <Label>Archivos</Label>
            <PendingFilesPicker files={pendingFiles} onChange={setPendingFiles} />
          </div>
        )}
        {error && <p className="text-sm text-error">{error}</p>}
      </form>
    </AppDialog>
  );
}
