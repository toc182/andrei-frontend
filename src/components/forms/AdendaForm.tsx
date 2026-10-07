import { useState, useEffect, type FormEvent } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { DatePicker } from '@/components/shell/DatePicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { diasEntre, tieneFecha, tieneMonto, terminacionAntesDe, TIPO_ADENDA } from '@/lib/adendas';
import { formatMoney } from '@/utils/formatters';
import type { Adenda, Project } from '@/types';

interface AdendaFormProps {
  project: Project;
  /** Las adendas del proyecto: de ellas sale la terminación anterior a esta. */
  adendas: Adenda[];
  isOpen: boolean;
  onClose: () => void;
  /** Guarda; devuelve el mensaje de error, o null si se guardó. */
  onSave: (data: Record<string, unknown>) => Promise<string | null>;
  editingAdenda?: Adenda | null;
}

const ESTADOS: { value: Adenda['estado']; label: string }[] = [
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'rechazada', label: 'Rechazada' },
];

/** 'YYYY-MM-DD' → 'DD/MM/YYYY', como lo muestra el DatePicker de al lado. */
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

/** El monto escrito, o null si no es un número. */
const leerMonto = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * Crear o editar una adenda. Un solo monto, con ITBMS y en negativo si reduce
 * el contrato. Los días se llenan solos con lo que hay entre la terminación
 * anterior y la nueva, pero se pueden cambiar: van como los dice la adenda, y a
 * veces se cuentan desde otra fecha (Ivan, 2026-10-07).
 */
const AdendaForm = ({ project, adendas, isOpen, onClose, onSave, editingAdenda = null }: AdendaFormProps) => {
  const [tipo, setTipo] = useState<Adenda['tipo']>('tiempo');
  const [estado, setEstado] = useState<Adenda['estado']>('en_proceso');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [dias, setDias] = useState('');
  // El último valor que el formulario puso solo en Días: si la persona no lo
  // cambió, se sigue recalculando al mover la fecha; si lo cambió, se respeta.
  const [diasAuto, setDiasAuto] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const numero = editingAdenda?.numero_adenda ?? null;
  const terminacionAnterior = terminacionAntesDe(project, adendas, numero);
  const calcularDias = (fecha: string): string => {
    const d = terminacionAnterior && fecha ? diasEntre(terminacionAnterior, fecha) : null;
    return d === null ? '' : String(d);
  };

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setGuardando(false);
    if (editingAdenda) {
      const fecha = editingAdenda.nueva_fecha_fin ?? '';
      const d = editingAdenda.dias_extension != null ? String(editingAdenda.dias_extension) : '';
      setTipo(editingAdenda.tipo);
      setEstado(editingAdenda.estado);
      setNuevaFecha(fecha);
      setDias(d);
      setDiasAuto(d !== '' && d === calcularDias(fecha) ? d : null);
      setMonto(editingAdenda.monto ?? '');
      setObservaciones(editingAdenda.observaciones ?? '');
    } else {
      setTipo('tiempo');
      setEstado('en_proceso');
      setNuevaFecha('');
      setDias('');
      setDiasAuto(null);
      setMonto('');
      setObservaciones('');
    }
    // calcularDias depende de las mismas adendas y proyecto: basta al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingAdenda]);

  const cambiarFecha = (fecha: string) => {
    setNuevaFecha(fecha);
    if (dias === '' || dias === diasAuto) {
      const d = calcularDias(fecha);
      setDias(d);
      setDiasAuto(d);
    }
  };

  // El contrato si esta adenda queda aprobada con este monto. Si se está
  // editando una que ya contaba, su monto de antes se quita primero.
  const vigenteActual = project.monto_vigente != null ? Number(project.monto_vigente) : null;
  const yaContaba =
    editingAdenda?.estado === 'aprobada' && editingAdenda.monto != null ? Number(editingAdenda.monto) : 0;
  const montoNum = leerMonto(monto);
  const resultante = vigenteActual !== null ? vigenteActual - yaContaba + (montoNum ?? 0) : null;

  const validar = (): string | null => {
    if (tieneFecha(tipo) && !nuevaFecha) return 'Falta la nueva fecha de terminación';
    if (tieneFecha(tipo) && dias !== '' && !Number.isInteger(Number(dias))) {
      return 'Los días de extensión tienen que ser un número entero';
    }
    if (tieneMonto(tipo)) {
      if (montoNum === null) return 'Falta el monto de la adenda';
      if (montoNum === 0) return 'El monto de la adenda no puede ser cero';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    setError('');
    const fallo = await onSave({
      tipo,
      estado,
      nueva_fecha_fin: tieneFecha(tipo) ? nuevaFecha : null,
      dias_extension: tieneFecha(tipo) && dias !== '' ? Number(dias) : null,
      monto: tieneMonto(tipo) ? monto.trim() : null,
      observaciones: observaciones.trim() || null,
    });
    setGuardando(false);
    if (fallo) setError(fallo);
  };

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !guardando) onClose();
      }}
      size="standard"
      title={editingAdenda ? `Editar Adenda #${editingAdenda.numero_adenda}` : 'Nueva Adenda'}
      description="Registra o modifica una adenda del contrato"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="adenda-form" disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingAdenda ? 'Guardar Cambios' : 'Crear Adenda'}
          </Button>
        </>
      }
    >
      <form id="adenda-form" onSubmit={handleSubmit} className="space-y-6">
        {error && <Alert variant="error" title={error} />}

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Información de la Adenda</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Adenda *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Adenda['tipo'])} disabled={guardando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_ADENDA) as Adenda['tipo'][]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_ADENDA[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as Adenda['estado'])} disabled={guardando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {tieneFecha(tipo) && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Modificación de Tiempo</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nueva Fecha de Terminación *</Label>
                <DatePicker value={nuevaFecha} onChange={cambiarFecha} disabled={guardando} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adenda-dias">Días de Extensión</Label>
                <Input
                  id="adenda-dias"
                  type="number"
                  step="1"
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  className="tabular-nums"
                  disabled={guardando}
                />
                {terminacionAnterior && (
                  <p className="text-xs text-muted-foreground">
                    {editingAdenda ? 'Desde la terminación anterior: ' : 'Desde la terminación vigente: '}
                    {fechaCorta(terminacionAnterior)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {tieneMonto(tipo) && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Modificación de Costo</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adenda-monto">Monto de la Adenda (ITBMS incluido) *</Label>
                <Input
                  id="adenda-monto"
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="tabular-nums"
                  disabled={guardando}
                />
                <p className="text-xs text-muted-foreground">En negativo si la adenda reduce el monto.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adenda-resultante">Monto Vigente Resultante</Label>
                <Input
                  id="adenda-resultante"
                  value={resultante !== null ? formatMoney(resultante) : '—'}
                  readOnly
                  tabIndex={-1}
                  className="bg-muted tabular-nums"
                />
                {vigenteActual !== null && (
                  <p className="text-xs text-muted-foreground">
                    Monto vigente actual: {formatMoney(vigenteActual)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Observaciones</h3>
          <div className="space-y-2">
            <Label htmlFor="adenda-observaciones">Observaciones Adicionales</Label>
            <Textarea
              id="adenda-observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              disabled={guardando}
            />
          </div>
        </div>
      </form>
    </AppDialog>
  );
};

export default AdendaForm;
