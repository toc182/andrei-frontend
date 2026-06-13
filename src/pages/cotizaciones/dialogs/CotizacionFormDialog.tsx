// Create or edit a cotización. On create, an optional first oferta
// (proveedor + monto + nota + files) can be captured in the same save —
// the capture-friction goal. Files upload after the oferta is created.

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AppDialog } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/services/api';
import type { CotizacionTipo, CotizacionAmbito, CotizacionDetalle } from '@/types/api';
import { PendingFilesPicker } from '../components/PendingFilesPicker';

interface ProjectOption {
  id: number;
  nombre: string;
  nombre_corto?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  initial?: CotizacionDetalle | null;
  projects: ProjectOption[];
  onSaved: () => void;
}

// The proyecto dropdown mixes two non-project options with the project
// list. These sentinels stand in for the non-project choices; any other
// value is a numeric project id.
const AMBITO_OFICINA = '__oficina__';
const AMBITO_OTROS = '__otros__';

export function CotizacionFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  projects,
  onSaved,
}: Props) {
  const [descripcion, setDescripcion] = useState('');
  const [descripcionLarga, setDescripcionLarga] = useState('');
  const [tipo, setTipo] = useState<CotizacionTipo | null>(null);
  const [proyectoId, setProyectoId] = useState<string>(AMBITO_OFICINA);
  // first oferta (create only)
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setProveedor('');
    setMonto('');
    setNota('');
    setPendingFiles([]);
    if (mode === 'edit' && initial) {
      setDescripcion(initial.descripcion);
      setDescripcionLarga(initial.descripcion_larga ?? '');
      setTipo(initial.tipo);
      setProyectoId(
        initial.proyecto_id
          ? String(initial.proyecto_id)
          : initial.ambito === 'otros'
            ? AMBITO_OTROS
            : AMBITO_OFICINA,
      );
    } else {
      setDescripcion('');
      setDescripcionLarga('');
      setTipo(null);
      setProyectoId(AMBITO_OFICINA);
    }
  }, [open, mode, initial]);

  const submit = async () => {
    setError('');
    if (!descripcion.trim()) {
      setError('La descripción es obligatoria');
      return;
    }
    setSaving(true);
    try {
      let proyecto_id: number | null = null;
      let ambito: CotizacionAmbito | null = null;
      if (proyectoId === AMBITO_OFICINA) {
        ambito = 'oficina';
      } else if (proyectoId === AMBITO_OTROS) {
        ambito = 'otros';
      } else {
        proyecto_id = Number(proyectoId);
      }

      const baseBody = {
        descripcion: descripcion.trim(),
        descripcion_larga: descripcionLarga.trim() || null,
        tipo,
        proyecto_id,
        ambito,
      };

      if (mode === 'edit' && initial) {
        await api.put(`/cotizaciones/${initial.id}`, baseBody);
      } else {
        const body: typeof baseBody & {
          oferta?: { proveedor: string; monto: number | null; nota: string | null };
        } = { ...baseBody };
        if (proveedor.trim()) {
          body.oferta = {
            proveedor: proveedor.trim(),
            monto: monto ? Number(monto) : null,
            nota: nota.trim() || null,
          };
        }
        const res = await api.post('/cotizaciones', body);
        const ofertaId: number | undefined = res.data?.data?.oferta?.id;
        if (ofertaId && pendingFiles.length > 0) {
          const formData = new FormData();
          pendingFiles.forEach((f) => formData.append('archivos', f));
          try {
            await api.post(`/cotizaciones/ofertas/${ofertaId}/archivos`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (uploadErr) {
            // Cotización + oferta already created; surface upload-only failure.
            console.error('Error subiendo archivos:', uploadErr);
            setError(
              'La cotización se guardó, pero algunos archivos no se subieron. Puedes agregarlos desde el detalle.',
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

  const toggleTipo = (value: CotizacionTipo) =>
    setTipo((prev) => (prev === value ? null : value));

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title={mode === 'edit' ? 'Editar cotización' : 'Nueva cotización'}
      description={
        mode === 'edit'
          ? undefined
          : 'Describe qué se cotiza. Puedes agregar la primera oferta ahora o después.'
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button form="cotizacion-form" type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'edit' ? 'Guardar' : 'Crear'}
          </Button>
        </>
      }
    >
      <form
        id="cotizacion-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <Label>Descripción</Label>
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Cemento gris — 100 sacos"
            maxLength={255}
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <Label>
            Descripción detallada{' '}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            value={descripcionLarga}
            onChange={(e) => setDescripcionLarga(e.target.value)}
            placeholder="Detalles, especificaciones, contexto…"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>
              Tipo{' '}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={tipo === 'producto' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => toggleTipo('producto')}
              >
                Producto
              </Button>
              <Button
                type="button"
                variant={tipo === 'servicio' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => toggleTipo('servicio')}
              >
                Servicio
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>
              Proyecto{' '}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Select value={proyectoId} onValueChange={setProyectoId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AMBITO_OFICINA}>Oficina</SelectItem>
                <SelectItem value={AMBITO_OTROS}>Otros</SelectItem>
                {projects.length > 0 && <SelectSeparator />}
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre_corto || p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === 'create' && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-semibold">
              Primera oferta{' '}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </p>
            <div className="space-y-1">
              <Label>Proveedor</Label>
              <Input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre del proveedor"
                maxLength={255}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Precio (B/.)</Label>
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
                <Label>Nota</Label>
                <Input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej: entrega incluida"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Archivos</Label>
              <PendingFilesPicker files={pendingFiles} onChange={setPendingFiles} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}
      </form>
    </AppDialog>
  );
}
