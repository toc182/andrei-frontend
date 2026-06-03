import { useEffect, useState } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { DatePicker } from '@/components/shell/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import type { CuentaAjusteOpcion, CuentaAjusteTipo } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: number;
  onCreated: () => void;
}

interface AjusteFormItem {
  tipo: CuentaAjusteTipo;
  descripcion: string;
  monto: string;
}

export default function CreateCuentaDialog({ open, onOpenChange, projectId, onCreated }: Props) {
  const [monto, setMonto] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [avance, setAvance] = useState('');
  const [esFinal, setEsFinal] = useState(false);
  const [ajustes, setAjustes] = useState<AjusteFormItem[]>([]);
  const [opciones, setOpciones] = useState<CuentaAjusteOpcion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [createOpcionForRow, setCreateOpcionForRow] = useState<number | null>(null);
  const [newOpcionTipo, setNewOpcionTipo] = useState<CuentaAjusteTipo>('disminucion');
  const [newOpcionDescripcion, setNewOpcionDescripcion] = useState('');
  const [savingOpcion, setSavingOpcion] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMonto('');
    setPeriodoInicio('');
    setPeriodoFin('');
    setAvance('');
    setEsFinal(false);
    setAjustes([]);
    setError('');
    (async () => {
      try {
        const res = await api.get(`/cuentas/proyecto/${projectId}/ajuste-opciones`);
        setOpciones(res.data.data ?? []);
      } catch {
        setOpciones([]);
      }
    })();
  }, [open, projectId]);

  const addAjuste = () =>
    setAjustes((prev) => [...prev, { tipo: 'disminucion', descripcion: '', monto: '' }]);
  const selectAjusteOpcion = (i: number, tipo: CuentaAjusteTipo, descripcion: string) =>
    setAjustes((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, tipo, descripcion } : a)),
    );
  const updateAjusteMonto = (i: number, value: string) =>
    setAjustes((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, monto: value } : a)),
    );
  const removeAjuste = (i: number) =>
    setAjustes((prev) => prev.filter((_, idx) => idx !== i));

  const openCreateOpcion = (rowIndex: number) => {
    setCreateOpcionForRow(rowIndex);
    setNewOpcionTipo(ajustes[rowIndex]?.tipo || 'disminucion');
    setNewOpcionDescripcion('');
  };

  const saveNewOpcion = async () => {
    if (createOpcionForRow === null) return;
    const trimmed = newOpcionDescripcion.trim();
    if (!trimmed) return;
    setSavingOpcion(true);
    try {
      const res = await api.post(`/cuentas/proyecto/${projectId}/ajuste-opciones`, {
        tipo: newOpcionTipo,
        descripcion: trimmed,
      });
      const created: CuentaAjusteOpcion = res.data.data;
      setOpciones((prev) => [...prev, created]);
      selectAjusteOpcion(createOpcionForRow, created.tipo, created.descripcion);
      setCreateOpcionForRow(null);
    } finally {
      setSavingOpcion(false);
    }
  };

  const montoAPagarLive =
    (Number(monto) || 0) +
    ajustes.reduce(
      (acc, a) => acc + (a.tipo === 'aumento' ? Number(a.monto) || 0 : -(Number(a.monto) || 0)),
      0,
    );

  const submit = async () => {
    setError('');
    if (!monto) { setError('Monto es requerido'); return; }
    setSaving(true);
    try {
      const ajustesPayload = ajustes
        .filter((a) => a.descripcion.trim() && a.monto !== '')
        .map((a, i) => ({
          tipo: a.tipo,
          descripcion: a.descripcion.trim(),
          monto: Number(a.monto),
          orden: i,
        }));
      await api.post('/cuentas', {
        proyecto_id: projectId,
        monto_total: Number(monto),
        periodo_inicio: periodoInicio || undefined,
        periodo_fin: periodoFin || undefined,
        avance_porcentaje: avance ? Number(avance) : undefined,
        es_final: esFinal,
        ajustes: ajustesPayload.length > 0 ? ajustesPayload : undefined,
      });
      onCreated();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Error al crear cuenta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppDialog
        open={open}
        onOpenChange={onOpenChange}
        size="simple"
        title="Nueva Cuenta"
        description="La cuenta se creará como borrador."
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button form="create-cuenta-form" type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </>
        }
      >
        <form id="create-cuenta-form" onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="flex-1">Monto bruto (B/.)</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-40 tabular-nums text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="h-9 w-9 shrink-0" aria-hidden />
          </div>

          <div className="space-y-2">
            {ajustes.length > 0 && (
              <div className="space-y-2">
                {ajustes.map((aj, index) => {
                  const selectedKey = aj.descripcion ? `${aj.tipo}|${aj.descripcion}` : '';
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-9 w-9 inline-flex items-center justify-center rounded-md border font-bold text-base shrink-0',
                          !aj.descripcion
                            ? 'text-muted-foreground border-border'
                            : aj.tipo === 'aumento'
                              ? 'text-success border-success/30'
                              : 'text-error border-error/30',
                        )}
                        aria-hidden
                      >
                        {!aj.descripcion ? '' : aj.tipo === 'aumento' ? '+' : '−'}
                      </span>
                      <Select
                        value={selectedKey}
                        onValueChange={(value) => {
                          if (value === '__new__') {
                            openCreateOpcion(index);
                            return;
                          }
                          const sep = value.indexOf('|');
                          const tipo = value.slice(0, sep) as CuentaAjusteTipo;
                          const descripcion = value.slice(sep + 1);
                          selectAjusteOpcion(index, tipo, descripcion);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Seleccionar ajuste" />
                        </SelectTrigger>
                        <SelectContent>
                          {opciones.map((o) => (
                            <SelectItem
                              key={`${o.tipo}|${o.descripcion}`}
                              value={`${o.tipo}|${o.descripcion}`}
                            >
                              <span
                                className={cn(
                                  'font-bold mr-2',
                                  o.tipo === 'aumento' ? 'text-success' : 'text-error',
                                )}
                              >
                                {o.tipo === 'aumento' ? '+' : '−'}
                              </span>
                              {o.descripcion}
                            </SelectItem>
                          ))}
                          {opciones.length > 0 && <SelectSeparator />}
                          <SelectItem value="__new__">
                            <span className="inline-flex items-center">
                              <Plus className="h-3 w-3 mr-1" />
                              Crear nueva opción
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={aj.monto}
                        onChange={(e) => updateAjusteMonto(index, e.target.value)}
                        className="w-40 tabular-nums text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAjuste(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAjuste}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar Ajuste
            </Button>
          </div>

          {ajustes.length > 0 && (
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <span className="flex-1 font-semibold">Total a cobrar</span>
              <span className="w-40 text-right font-semibold tabular-nums pr-3">
                B/. {montoAPagarLive.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="w-9 shrink-0" aria-hidden />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periodo inicio</Label>
              <DatePicker value={periodoInicio} onChange={setPeriodoInicio} />
            </div>
            <div>
              <Label>Periodo fin</Label>
              <DatePicker value={periodoFin} onChange={setPeriodoFin} />
            </div>
          </div>
          <div>
            <Label>Avance (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" value={avance} onChange={(e) => setAvance(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={esFinal} onChange={(e) => setEsFinal(e.target.checked)} />
            Cuenta Final
          </label>
          {error && <p className="text-sm text-error">{error}</p>}
        </form>
      </AppDialog>

      <AppDialog
        open={createOpcionForRow !== null}
        onOpenChange={(v) => { if (!v) setCreateOpcionForRow(null); }}
        size="confirm"
        title="Nueva opción de ajuste"
        description="Esta opción quedará disponible para futuras cuentas de este proyecto."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpcionForRow(null)} disabled={savingOpcion}>Cancelar</Button>
            <Button onClick={saveNewOpcion} disabled={savingOpcion || !newOpcionDescripcion.trim()}>
              {savingOpcion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={newOpcionTipo} onValueChange={(v) => setNewOpcionTipo(v as CuentaAjusteTipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disminucion">
                  <span className="text-error font-bold mr-2">−</span>
                  Disminución
                </SelectItem>
                <SelectItem value="aumento">
                  <span className="text-success font-bold mr-2">+</span>
                  Aumento
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Input
              value={newOpcionDescripcion}
              onChange={(e) => setNewOpcionDescripcion(e.target.value)}
              placeholder="Ej: Retención 5%"
              autoFocus
            />
          </div>
        </div>
      </AppDialog>
    </>
  );
}
