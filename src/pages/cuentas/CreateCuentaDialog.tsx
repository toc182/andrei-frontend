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
          {/* Panel-recibo: monto bruto + ajustes + total, alineados al mismo borde derecho.
              El pr-8 crea el canal para la papelera, que se posiciona en el margen. */}
          <div className="rounded-lg border border-border bg-secondary/60 py-3.5 pl-4 pr-8">
            <div className="mb-2.5">
              <span className="border-l-2 border-primary pl-2 text-[11px] font-bold uppercase tracking-wider leading-none text-primary">
                Cálculo
              </span>
            </div>

            {/* Monto bruto */}
            <div className="grid min-h-[34px] grid-cols-[1fr_auto] items-center gap-x-2.5">
              <Label className="font-semibold text-foreground">Monto bruto</Label>
              <span className="flex items-baseline justify-end gap-1">
                <span className="text-xs text-muted-foreground">B/.</span>
                <Input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="h-auto w-20 border-0 bg-transparent p-0 py-1 text-right tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </span>
            </div>

            {ajustes.length > 0 && <div className="my-1.5 h-px bg-border" />}

            {/* Ajustes */}
            {ajustes.map((aj, index) => {
              const selectedKey = aj.descripcion ? `${aj.tipo}|${aj.descripcion}` : '';
              return (
                <div
                  key={index}
                  className="group/row relative grid min-h-[34px] grid-cols-[1fr_auto] items-center gap-x-2.5"
                >
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
                    <SelectTrigger className="h-auto border-0 bg-transparent px-0 py-1 shadow-none focus:ring-0 focus-visible:ring-0 [&>svg]:opacity-60">
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
                  <span className="flex items-baseline justify-end gap-1">
                    <span className="text-xs text-muted-foreground">B/.</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={aj.monto}
                      onChange={(e) => updateAjusteMonto(index, e.target.value)}
                      className={cn(
                        'h-auto w-20 border-0 bg-transparent p-0 py-1 text-right tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                        aj.descripcion && (aj.tipo === 'aumento' ? 'text-success' : 'text-error'),
                      )}
                    />
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-[-26px] top-1/2 h-6 w-6 -translate-y-1/2 p-0 text-transparent group-hover/row:text-muted-foreground hover:!text-error"
                    onClick={() => removeAjuste(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            <Button
              type="button"
              variant="ghost"
              onClick={addAjuste}
              className="mt-1 h-auto w-full justify-center gap-1.5 rounded-md border border-dashed border-border bg-transparent py-2 text-xs font-semibold text-muted-foreground hover:border-primary/30 hover:bg-transparent hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              Agregar ajuste
            </Button>

            <div className="mt-2 grid grid-cols-[1fr_auto] items-baseline gap-x-2.5 border-t border-border pt-2.5">
              <span className="text-sm font-semibold text-primary">Monto a pagar</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                B/. {montoAPagarLive.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

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
