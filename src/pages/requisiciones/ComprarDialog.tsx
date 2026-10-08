/**
 * El paso antes de la solicitud de pago o la orden de compra que nace de una
 * requisición (mock 15, aprobado el 2026-10-05): qué líneas van, a quién se le
 * compra y qué va adjunto. «Continuar» abre el formulario de siempre ya lleno.
 *
 * Aquí no se guarda nada: si se cancela el formulario, la requisición queda
 * como estaba. Las marcas cambian cuando la solicitud se crea.
 */
import { useEffect, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { AppDialog } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatMoney } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { cantidadDe, ETIQUETA_MARCA, enumerar, posiciones, textoLineas } from './formato';
import { MarcaSelector } from './etiquetas';
import type { ArchivoQueVa, DesdeRequisicion, RequisicionDetalle, TipoCompra } from './tipos';

const OTRO = 'otro';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisicion: RequisicionDetalle;
  tipo: TipoCompra;
  onContinuar: (desde: DesdeRequisicion) => void;
}

export default function ComprarDialog({ open, onOpenChange, requisicion: req, tipo, onContinuar }: Props) {
  const [marcas, setMarcas] = useState<Record<number, 'atendida' | 'parcial'>>({});
  const [proveedor, setProveedor] = useState<string>('');

  const unica = req.lineas.length === 1 ? req.lineas[0].id : null;
  useEffect(() => {
    if (!open) return;
    // Con una sola línea no hay nada que escoger.
    setMarcas(unica !== null ? { [unica]: 'atendida' } : {});
    setProveedor('');
  }, [open, unica]);

  const elegidas = req.lineas.filter((l) => marcas[l.id]).map((l) => l.id);
  const cubre = (lineas: number[]) => lineas.some((id) => elegidas.includes(id));
  const cotizaciones = req.cotizaciones.filter((c) => cubre(c.lineas));
  const cuadros = req.adjuntos.filter((a) => a.tipo === 'cuadro_comparativo' && cubre(a.lineas));

  // Si se quitan las líneas que cubría la cotización escogida, deja de estar
  // escogida: no se le compra a quien no cotizó lo que va.
  const comprarA = proveedor === OTRO || cotizaciones.some((c) => String(c.id) === proveedor) ? proveedor : '';

  const archivos: ArchivoQueVa[] =
    elegidas.length === 0
      ? []
      : [
      ...cotizaciones.map((c) => ({
        clave: `cotizacion-${c.id}`,
        tipo: 'cotizacion' as const,
        id: c.id,
        nombre: c.nombre_original,
        detalle: `Cotización · ${c.proveedor}`,
      })),
      ...cuadros.map((a) => ({
        clave: `cuadro-${a.id}`,
        tipo: 'cuadro' as const,
        id: a.id,
        nombre: a.nombre_original,
        detalle: 'Cuadro comparativo',
      })),
      {
        clave: 'papel',
        tipo: 'papel' as const,
        id: null,
        nombre: `${req.numero}.pdf`,
        detalle: `La requisición, con ${elegidas.length === 1 ? 'la' : 'las'} ${textoLineas(elegidas, req.lineas)} ${elegidas.length === 1 ? 'marcada' : 'marcadas'}`,
      },
    ];

  const escogida = cotizaciones.find((c) => String(c.id) === comprarA) ?? null;
  const listo = elegidas.length > 0 && comprarA !== '';

  const continuar = () => {
    onContinuar({
      requisicion_id: req.id,
      numero: req.numero,
      lineasTexto: textoLineas(elegidas, req.lineas),
      proveedor: escogida?.proveedor ?? '',
      urgente: req.prioridad === 'urgente',
      beneficiario: req.beneficiario,
      banco: req.banco,
      tipo_cuenta: req.tipo_cuenta,
      numero_cuenta: req.numero_cuenta,
      lineas: elegidas.map((id) => ({ id, marca: marcas[id] })),
      cotizacion_id: escogida?.id ?? null,
      archivos,
      renglones: req.lineas
        .filter((l) => marcas[l.id])
        .map((l) => ({ cantidad: cantidadDe(l.cantidad), unidad: l.unidad, descripcion: l.descripcion })),
    });
  };

  const solicitud = tipo === 'solicitud';

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title={solicitud ? 'Crear solicitud de pago' : 'Crear orden de compra'}
      description={`${req.numero} · ${req.proyecto_nombre}`}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-muted-foreground">
            {solicitud ? 'Se abre la solicitud con todo esto ya puesto.' : 'Se abre la orden con todo esto ya puesto.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={continuar} disabled={!listo} className="flex-1 sm:flex-none">
              Continuar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <Label>{solicitud ? 'Líneas que paga' : 'Líneas que compra'}</Label>
          <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-border">
            {req.lineas.map((l, i) => {
              const marca = marcas[l.id];
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <Checkbox
                      id={`comprar-linea-${l.id}`}
                      checked={!!marca}
                      onCheckedChange={(v) =>
                        setMarcas((m) => {
                          const n = { ...m };
                          if (v) n[l.id] = 'atendida';
                          else delete n[l.id];
                          return n;
                        })
                      }
                      className="mt-0.5"
                    />
                    <Label htmlFor={`comprar-linea-${l.id}`} className="cursor-pointer text-sm font-normal leading-5">
                      <span className="text-muted-foreground">{i + 1}.</span> {l.descripcion}{' '}
                      <span className="tabular-nums text-muted-foreground">
                        · {cantidadDe(l.cantidad)}
                        {l.unidad ? ` ${l.unidad}` : ''}
                      </span>
                    </Label>
                  </div>
                  <div className="shrink-0">
                    {marca ? (
                      <MarcaSelector
                        marca={marca}
                        opciones={['atendida', 'parcial']}
                        onCambiar={(m) => setMarcas((x) => ({ ...x, [l.id]: m as 'atendida' | 'parcial' }))}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{ETIQUETA_MARCA[l.marca]}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Las líneas elegidas quedan como Atendida. Cámbiala a Parcial si solo se compra una parte.
          </p>
        </div>

        <div>
          <Label>Comprar a</Label>
          {elegidas.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Escoge primero las líneas.</p>
          ) : (
            <RadioGroup value={comprarA} onValueChange={setProveedor} className="mt-1 gap-2">
              {[...cotizaciones.map((c) => ({ valor: String(c.id), c })), { valor: OTRO, c: null }].map(({ valor, c }) => (
                <Label
                  key={valor}
                  htmlFor={`comprar-a-${valor}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 font-normal',
                    comprarA === valor ? 'border-primary' : 'border-border',
                  )}
                >
                  <RadioGroupItem value={valor} id={`comprar-a-${valor}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{c ? c.proveedor : 'Otro proveedor'}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c
                        ? `Cubre ${c.lineas.length === 1 ? 'la línea' : 'las líneas'} ${enumerar(posiciones(c.lineas, req.lineas))}`
                        : `Sin cotización: se escribe en la ${solicitud ? 'solicitud' : 'orden'}`}
                    </span>
                  </span>
                  {c?.monto != null && <span className="shrink-0 text-sm tabular-nums text-slate-700">{formatMoney(c.monto)}</span>}
                </Label>
              ))}
            </RadioGroup>
          )}
        </div>

        {archivos.length > 0 && (
          <div>
            <Label>Van adjuntos</Label>
            <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-border">
              {archivos.map((a) => (
                <div key={a.clave} className="flex items-center gap-2 px-3 py-2">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate text-sm text-foreground">{a.nombre}</span>
                  <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:inline">{a.detalle}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppDialog>
  );
}
