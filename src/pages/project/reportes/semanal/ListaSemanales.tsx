/**
 * La lista de reportes semanales de un proyecto.
 *
 * Mismo patrón que la de los diarios: tabla en escritorio, tarjetas en el
 * teléfono. Dos columnas nombran la semana —su número, con el año debajo, y sus
 * fechas— porque el número se repite todos los años: hay una semana 37 en 2026
 * y otra en 2027. La columna Metas resume en tres puntos de color cómo quedó lo
 * que se había planeado.
 */

import { Download, Loader2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/shell';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { rangoSemana, type SemanalFila } from './tipos';

function Metas({ fila }: { fila: SemanalFila }) {
  if (fila.metas === 0) {
    return <span className="text-sm text-muted-foreground">Sin metas anteriores</span>;
  }
  const puntos = [
    { n: fila.metas_completadas, color: 'bg-success' },
    { n: fila.metas_parciales, color: 'bg-warning' },
    { n: fila.metas_no_completadas, color: 'bg-error' },
  ];
  return (
    <span className="flex items-center gap-3 text-sm tabular-nums text-slate-700">
      {puntos.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
          {p.n}
        </span>
      ))}
    </span>
  );
}

/** El número de la semana, con su año debajo. */
function NumeroSemana({ fila }: { fila: SemanalFila }) {
  return (
    <span className="flex flex-col items-center tabular-nums">
      <span className="text-lg font-semibold leading-tight text-navy">{fila.semana_iso}</span>
      <span className="text-[11px] leading-none text-muted-foreground">{fila.anio_iso}</span>
    </span>
  );
}

/** Las fechas de la semana, en una píldora. */
function Fechas({ fila }: { fila: SemanalFila }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-navy/30 bg-navy/5 px-2.5 py-0.5 text-sm font-medium tabular-nums text-navy">
      {rangoSemana(fila.semana_inicio, fila.semana_fin)}
    </span>
  );
}

export default function ListaSemanales({
  filas, onAbrir, onNuevo, onPdf, bajando,
}: {
  filas: SemanalFila[];
  onAbrir: (id: number) => void;
  onNuevo: () => void;
  onPdf: (id: number) => void;
  /** El reporte cuyo PDF se está generando, si hay alguno. */
  bajando: number | null;
}) {
  /** El botón del PDF: la fila entera abre el reporte, así que este no. */
  const botonPdf = (f: SemanalFila, enFila: boolean) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 flex-none text-muted-foreground hover:text-navy"
      title={`Descargar el PDF de ${f.numero}`}
      disabled={bajando === f.id}
      onClick={(e) => {
        if (enFila) e.stopPropagation();
        onPdf(f.id);
      }}
    >
      {bajando === f.id
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />}
      <span className="sr-only">Descargar PDF</span>
    </Button>
  );

  if (filas.length === 0) {
    return (
      <Card className="overflow-hidden p-0">
        <EmptyState
          title="Sin reportes semanales"
          description="El reporte semanal resume la semana a partir de los reportes diarios."
          action={(
            <Button size="sm" onClick={onNuevo}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo reporte semanal
            </Button>
          )}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
              <TableHead className="w-[88px] px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Semana
              </TableHead>
              <TableHead className="w-[200px] px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fechas
              </TableHead>
              <TableHead className="whitespace-nowrap px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[190px]">
                Código
              </TableHead>
              <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[230px]">
                Elaborado por
              </TableHead>
              <TableHead className="w-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Metas
              </TableHead>
              <TableHead className="w-[64px] px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                PDF
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow
                key={f.id}
                className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                onClick={() => onAbrir(f.id)}
              >
                <TableCell className="px-4 py-3 text-center"><NumeroSemana fila={f} /></TableCell>
                <TableCell className="px-4 py-3 text-center"><Fechas fila={f} /></TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-center text-sm tabular-nums text-slate-700">
                  {f.numero}
                </TableCell>
                <TableCell className="px-4 py-3 text-center text-sm text-muted-foreground">
                  {f.creador_nombre}
                </TableCell>
                <TableCell className="px-4 py-3"><Metas fila={f} /></TableCell>
                <TableCell className="px-2 py-3 text-center">{botonPdf(f, true)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden">
        {filas.map((f) => (
          /* El botón del PDF va FUERA del que abre el reporte: un botón dentro
             de otro no es HTML válido. */
          <div
            key={f.id}
            className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/60"
          >
          <button
            type="button"
            onClick={() => onAbrir(f.id)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Semana {f.semana_iso} · {f.anio_iso}
              </span>
              <span className="mt-1 block"><Fechas fila={f} /></span>
              <span className="mt-1 block text-sm font-medium tabular-nums text-foreground">
                {f.numero}
              </span>
              <span className="block text-xs text-muted-foreground">{f.creador_nombre}</span>
              <span className="mt-1 block"><Metas fila={f} /></span>
            </span>
          </button>
          {botonPdf(f, false)}
          </div>
        ))}
      </div>
    </Card>
  );
}
