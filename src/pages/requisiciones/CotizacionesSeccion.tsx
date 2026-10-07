/**
 * Las cotizaciones de una requisición aprobada, y sus cuadros comparativos.
 *
 * Una tabla para los dos (mock 12, aprobado el 2026-10-05): el cuadro va con
 * su etiqueta donde la cotización lleva el proveedor. Las agrega y las quita
 * Compras (llave Atender); los demás que ven la requisición solo las consultan.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import api from '@/services/api';
import { Alert, SectionHeader } from '@/components/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { formatMoney } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import CotizacionDialog from './CotizacionDialog';
import { diaDeMomento, numerosDeLineas } from './formato';
import type { RequisicionDetalle } from './tipos';

const CABECERA = 'py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

interface Fila {
  /** 'cotizacion' sale de requisicion_cotizaciones; 'cuadro', de sus adjuntos. */
  clase: 'cotizacion' | 'cuadro';
  id: number;
  proveedor: string | null;
  monto: string | null;
  archivo: string;
  lineas: number[];
  created_at: string;
}

interface Props {
  requisicion: RequisicionDetalle;
  onCambio: () => void;
}

export default function CotizacionesSeccion({ requisicion: req, onCambio }: Props) {
  const puede = req.puede.atender;
  const [agregando, setAgregando] = useState(false);
  const [quitando, setQuitando] = useState<Fila | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filas: Fila[] = [
    ...req.cotizaciones.map((c) => ({
      clase: 'cotizacion' as const,
      id: c.id,
      proveedor: c.proveedor,
      monto: c.monto,
      archivo: c.nombre_original,
      lineas: c.lineas,
      created_at: c.created_at,
    })),
    ...req.adjuntos
      .filter((a) => a.tipo === 'cuadro_comparativo')
      .map((a) => ({
        clase: 'cuadro' as const,
        id: a.id,
        proveedor: null,
        monto: null,
        archivo: a.nombre_original,
        lineas: a.lineas,
        created_at: a.created_at,
      })),
  ];

  // Los enlaces de R2 caducan a los 15 minutos: se piden al abrir, no al
  // cargar la página. La pestaña se abre antes de pedirlo, porque si se abre
  // después de esperar al servidor el navegador la bloquea.
  const abrir = async (f: Fila) => {
    const pestana = window.open('', '_blank');
    try {
      const res = await api.get(`/requisiciones/${req.id}/archivos/urls`);
      const lista = (f.clase === 'cotizacion' ? res.data.cotizaciones : res.data.adjuntos) as { id: number; url: string }[];
      const url = lista.find((x) => x.id === f.id)?.url;
      if (!url) throw new Error('sin enlace');
      if (pestana) {
        pestana.opener = null;
        pestana.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch {
      pestana?.close();
      setError(`No se pudo abrir ${f.archivo}`);
    }
  };

  const quitar = async () => {
    if (!quitando) return;
    setOcupado(true);
    try {
      await api.delete(
        quitando.clase === 'cotizacion'
          ? `/requisiciones/${req.id}/cotizaciones/${quitando.id}`
          : `/requisiciones/${req.id}/adjuntos/${quitando.id}`,
      );
      setQuitando(null);
      setError(null);
      onCambio();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setQuitando(null);
      setError(e.response?.data?.error ?? 'No se pudo quitar');
    } finally {
      setOcupado(false);
    }
  };

  const nombre = (f: Fila) =>
    f.clase === 'cotizacion' ? (
      <span className="font-medium text-foreground">{f.proveedor}</span>
    ) : (
      <Badge className="bg-slate-100 text-slate-600 border-slate-200 border">Cuadro comparativo</Badge>
    );

  const botonQuitar = (f: Fila) => (
    <Button
      variant="outline"
      size="icon"
      className="h-7 w-7 shrink-0"
      aria-label={f.clase === 'cotizacion' ? `Quitar la cotización de ${f.proveedor}` : `Quitar ${f.archivo}`}
      onClick={() => setQuitando(f)}
    >
      <X className="h-3.5 w-3.5 text-error" />
    </Button>
  );

  return (
    <div>
      <SectionHeader
        title="Cotizaciones"
        action={
          puede ? (
            <Button variant="outline" size="sm" onClick={() => setAgregando(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Agregar cotización</span>
              <span className="sm:hidden">Agregar</span>
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-3">
          <Alert variant="error" title={error} dismissible onDismiss={() => setError(null)} />
        </div>
      )}

      {filas.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Sin cotizaciones.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {/* Teléfono: un bloque por cotización. */}
          <div className="divide-y divide-slate-100 md:hidden">
            {filas.map((f) => (
              <div key={`${f.clase}-${f.id}`} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">{nombre(f)}</div>
                  <div className="flex shrink-0 items-center gap-2">
                    {f.monto !== null && <span className="text-sm tabular-nums text-slate-700">{formatMoney(f.monto)}</span>}
                    {puede && botonQuitar(f)}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Líneas {numerosDeLineas(f.lineas, req.lineas)} ·{' '}
                  <button type="button" onClick={() => void abrir(f)} className="text-primary hover:underline">
                    archivo
                  </button>
                </p>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                  <TableHead className={cn(CABECERA, 'w-[230px] px-4')}>Proveedor</TableHead>
                  <TableHead className={cn(CABECERA, 'w-[130px] px-4 text-right')}>Monto</TableHead>
                  <TableHead className={cn(CABECERA, 'px-4')}>Archivo</TableHead>
                  <TableHead className={cn(CABECERA, 'w-[110px] px-4')}>Líneas</TableHead>
                  <TableHead className={cn(CABECERA, 'w-[120px] px-4')}>Agregada</TableHead>
                  {puede && <TableHead className="w-[56px] px-4" aria-label="Quitar" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={`${f.clase}-${f.id}`} className="border-b border-slate-100 last:border-0 hover:bg-transparent">
                    <TableCell className="truncate px-4 py-3 text-sm">{nombre(f)}</TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                      {f.monto !== null ? formatMoney(f.monto) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => void abrir(f)}
                        title={f.archivo}
                        className="block max-w-full truncate text-left text-primary hover:underline"
                      >
                        {f.archivo}
                      </button>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm tabular-nums text-slate-700">
                      {numerosDeLineas(f.lineas, req.lineas)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm tabular-nums text-slate-700">{diaDeMomento(f.created_at)}</TableCell>
                    {puede && <TableCell className="px-4 py-2 text-right">{botonQuitar(f)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {puede && (
        <CotizacionDialog open={agregando} onOpenChange={setAgregando} requisicion={req} onListo={onCambio} />
      )}

      <AlertDialog open={!!quitando} onOpenChange={(v) => !ocupado && !v && setQuitando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {quitando?.clase === 'cotizacion'
                ? `¿Quitar la cotización de ${quitando.proveedor}?`
                : '¿Quitar el cuadro comparativo?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {quitando?.clase === 'cotizacion'
                ? 'Sale de la requisición y de Cotizaciones.'
                : `Sale de la requisición: ${quitando?.archivo ?? ''}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void quitar();
              }}
              disabled={ocupado}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {ocupado ? 'Quitando...' : 'Quitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
