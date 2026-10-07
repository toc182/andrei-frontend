/**
 * Agregar una cotización a una requisición aprobada, o un cuadro comparativo.
 *
 * Es la misma ventana para los dos (Ivan, 2026-10-05): el cuadro es un Tipo,
 * no otro botón. La cotización lleva el proveedor, el monto si lo tiene y las
 * líneas que cubre; queda también en Cotizaciones, una entrada por línea. El
 * cuadro comparativo lleva solo el archivo y las líneas que compara, y no sale
 * de la requisición.
 */
import { useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import api from '@/services/api';
import { AppDialog, Alert } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSoltarArchivos } from '@/hooks/useSoltarArchivos';
import { cn } from '@/lib/utils';
import { cantidadDe } from './formato';
import type { RequisicionDetalle } from './tipos';

type Tipo = 'cotizacion' | 'cuadro_comparativo';

// Lo mismo que acepta el servidor: un cuadro comparativo casi siempre es un Excel.
const TIPOS_ARCHIVO = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
const ARCHIVO_MAX = 10 * 1024 * 1024;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisicion: RequisicionDetalle;
  onListo: () => void;
}

export default function CotizacionDialog({ open, onOpenChange, requisicion, onListo }: Props) {
  const [tipo, setTipo] = useState<Tipo>('cotizacion');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [lineas, setLineas] = useState<number[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  // Con una sola línea no hay nada que escoger. Va como número y no como la
  // lista: la requisición se vuelve a pedir al cambiar una marca, y eso no
  // debe borrar lo que se está escribiendo aquí.
  const unica = requisicion.lineas.length === 1 ? requisicion.lineas[0].id : null;

  useEffect(() => {
    if (!open) return;
    setTipo('cotizacion');
    setArchivo(null);
    setProveedor('');
    setMonto('');
    setLineas(unica !== null ? [unica] : []);
    setError(null);
  }, [open, unica]);

  const escoger = (f: File | undefined) => {
    if (!f) return;
    if (!TIPOS_ARCHIVO.includes(f.type)) {
      setError(`${f.name}: solo PDF, JPG, PNG, WEBP o Excel`);
      return;
    }
    if (f.size > ARCHIVO_MAX) {
      setError(`${f.name}: pasa de 10 MB`);
      return;
    }
    setError(null);
    setArchivo(f);
  };

  const { encima, props: zona } = useSoltarArchivos({
    activo: open && !guardando,
    alSoltar: (aceptados, rechazados) => escoger([...aceptados, ...rechazados][0]),
  });

  const esCotizacion = tipo === 'cotizacion';
  const montoNumero = monto.trim() === '' ? null : Number(monto.replace(/,/g, ''));
  const montoMalo = montoNumero !== null && (!Number.isFinite(montoNumero) || montoNumero < 0);
  const listo =
    !!archivo && lineas.length > 0 && (!esCotizacion || (proveedor.trim() !== '' && !montoMalo));

  const agregar = async () => {
    if (!archivo || !listo) return;
    setGuardando(true);
    setError(null);
    const fd = new FormData();
    fd.append('archivo', archivo);
    fd.append('lineas', JSON.stringify(lineas));
    try {
      if (esCotizacion) {
        fd.append('proveedor', proveedor.trim());
        if (montoNumero !== null) fd.append('monto', String(montoNumero));
        await api.post(`/requisiciones/${requisicion.id}/cotizaciones`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        fd.append('tipo', 'cuadro_comparativo');
        await api.post(`/requisiciones/${requisicion.id}/adjuntos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      onOpenChange(false);
      onListo();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? 'No se pudo agregar');
    } finally {
      setGuardando(false);
    }
  };

  const marcar = (id: number, si: boolean) =>
    setLineas((ls) => (si ? [...ls, id] : ls.filter((x) => x !== id)));

  return (
    <AppDialog
      open={open}
      onOpenChange={(v) => !guardando && onOpenChange(v)}
      size="simple"
      title={esCotizacion ? 'Agregar cotización' : 'Agregar cuadro comparativo'}
      description={`${requisicion.numero} · ${requisicion.proyecto_nombre}`}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-muted-foreground">{esCotizacion ? 'También queda en Cotizaciones.' : ''}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button onClick={() => void agregar()} disabled={!listo || guardando} className="flex-1 sm:flex-none">
              {guardando ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error" title={error} />}

        <div>
          <Label>Tipo</Label>
          <RadioGroup
            value={tipo}
            onValueChange={(v) => setTipo(v as Tipo)}
            className="mt-2.5 flex items-center gap-5"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cotizacion" id="cot-tipo-cotizacion" />
              <Label htmlFor="cot-tipo-cotizacion" className="cursor-pointer font-normal">
                Cotización
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cuadro_comparativo" id="cot-tipo-cuadro" />
              <Label htmlFor="cot-tipo-cuadro" className="cursor-pointer font-normal">
                Cuadro comparativo
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <Label>Archivo</Label>
          <div
            {...zona}
            className={cn(
              'relative mt-1 overflow-hidden rounded-lg border',
              encima ? 'border-teal ring-2 ring-teal/30' : 'border-border',
            )}
          >
            {encima && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-card/90 text-sm font-semibold text-teal">
                Suelta el archivo aquí
              </div>
            )}
            {archivo && (
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-3">
                <span className="truncate text-sm">{archivo.name}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={`Quitar ${archivo.name}`}
                  onClick={() => setArchivo(null)}
                >
                  <X className="h-3.5 w-3.5 text-error" />
                </Button>
              </div>
            )}
            <div className="bg-slate-50 p-3">
              <button
                type="button"
                onClick={() => entrada.current?.click()}
                className="flex items-center gap-2 text-sm font-semibold text-primary"
              >
                <Upload className="h-4 w-4" />
                Subir archivo
                <span className="hidden font-normal text-muted-foreground md:inline">o arrástralo aquí</span>
              </button>
              <input
                ref={entrada}
                type="file"
                className="hidden"
                accept={TIPOS_ARCHIVO.join(',')}
                onChange={(e) => {
                  escoger(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>

        {esCotizacion && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cot-proveedor">Proveedor</Label>
              <Input
                id="cot-proveedor"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                maxLength={255}
                autoComplete="off"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cot-monto">
                Monto <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="cot-monto"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                autoComplete="off"
                className={cn('mt-1 text-right tabular-nums', montoMalo && 'border-error')}
              />
              {montoMalo && <p className="mt-1 text-xs text-error">El monto no es válido</p>}
            </div>
          </div>
        )}

        <div>
          <Label>{esCotizacion ? 'Líneas que cubre' : 'Líneas que compara'}</Label>
          <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-border">
            {requisicion.lineas.map((l, i) => (
              <div key={l.id} className="flex items-start gap-2 px-3 py-2.5">
                <Checkbox
                  id={`cot-linea-${l.id}`}
                  checked={lineas.includes(l.id)}
                  onCheckedChange={(v) => marcar(l.id, !!v)}
                  className="mt-0.5"
                />
                <Label htmlFor={`cot-linea-${l.id}`} className="cursor-pointer text-sm font-normal leading-5">
                  <span className="text-muted-foreground">{i + 1}.</span> {l.descripcion}{' '}
                  <span className="tabular-nums text-muted-foreground">
                    · {cantidadDe(l.cantidad)}
                    {l.unidad ? ` ${l.unidad}` : ''}
                  </span>
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
