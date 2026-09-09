/**
 * Reportes diarios de obra — la sección que sustituyó a la Bitácora.
 *
 * Este archivo es la lista y además decide qué se ve: la lista, el formulario
 * o el detalle.
 *
 * La lista sigue el patrón de las páginas que ya existen (Requisiciones,
 * Solicitudes) y no §10 de FRONTEND_CONVENTIONS: los filtros van ENCIMA de la
 * tarjeta, la tarjeta lleva solo la tabla, y la paginación va FUERA. Fue una
 * instrucción explícita de Ivan, para que se vea como el resto del sistema.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import api from '@/services/api';
import {
  EmptyState, ErrorState, PageHeader, TableSkeleton,
} from '@/components/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import ReporteForm from './reportes/ReporteForm';
import ReporteDetalle from './reportes/ReporteDetalle';
import AreasDialog from './reportes/AreasDialog';
import {
  type Reporte, type ReporteFila,
  clasesClima, diaDeLaSemana, etiquetaMes, fechaCorta,
} from './reportes/tipos';

interface Props {
  projectId: number;
}

type Vista =
  | { modo: 'lista' }
  | { modo: 'nuevo' }
  | { modo: 'editar'; reporte: Reporte }
  | { modo: 'detalle'; id: number };

const TAMANOS = [25, 50, 100];

/** Las horas perdidas resaltan solo cuando las hay. */
function Horas({ valor }: { valor: string | null }) {
  const n = valor ? Number(valor) : 0;
  if (!n) return <span className="text-slate-300">—</span>;
  return <span className="font-semibold text-warning tabular-nums">{n}</span>;
}

export default function ProjectReportes({ projectId }: Props) {
  const [vista, setVista] = useState<Vista>({ modo: 'lista' });
  const [filas, setFilas] = useState<ReporteFila[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [mes, setMes] = useState('todos');
  const [autor, setAutor] = useState('todos');
  const [meses, setMeses] = useState<string[]>([]);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [areasAbierto, setAreasAbierto] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(false);
    api
      .get(`/proyecto-reportes/${projectId}`, {
        params: {
          q: busqueda || undefined,
          mes: mes === 'todos' ? undefined : mes,
          creado_por: autor === 'todos' ? undefined : autor,
          limit: porPagina,
          offset: (pagina - 1) * porPagina,
        },
      })
      .then((r) => {
        setFilas(r.data.data ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [projectId, busqueda, mes, autor, pagina, porPagina]);

  useEffect(() => {
    if (vista.modo === 'lista') cargar();
  }, [vista.modo, cargar]);

  useEffect(() => {
    api
      .get(`/proyecto-reportes/${projectId}/meses`)
      .then((r) => setMeses(r.data.data ?? []))
      .catch(() => setMeses([]));
  }, [projectId, vista.modo]);

  // Los autores salen de lo que ya hay en la lista: no hace falta un endpoint
  // aparte para llenar un filtro.
  const autores = Array.from(
    new Map(filas.map((f) => [f.creado_por, f.creador_nombre])).entries(),
  );

  if (vista.modo === 'nuevo' || vista.modo === 'editar') {
    const editando = vista.modo === 'editar' ? vista.reporte : undefined;
    return (
      <div className="space-y-6">
        <PageHeader
          title={editando ? `Corregir ${editando.numero}` : 'Nuevo reporte diario'}
          subtitle={
            editando
              ? 'Todo lo que cambies queda registrado con tu nombre y la hora'
              : 'La fecha viene con la de hoy; cámbiala si estás mandando uno atrasado'
          }
        />
        <ReporteForm
          projectId={projectId}
          reporte={editando}
          onCancelar={() =>
            setVista(editando ? { modo: 'detalle', id: editando.id } : { modo: 'lista' })
          }
          onListo={() =>
            setVista(editando ? { modo: 'detalle', id: editando.id } : { modo: 'lista' })
          }
        />
      </div>
    );
  }

  if (vista.modo === 'detalle') {
    return (
      <ReporteDetalle
        projectId={projectId}
        reporteId={vista.id}
        onVolver={() => setVista({ modo: 'lista' })}
        onEditar={(r) => setVista({ modo: 'editar', reporte: r })}
      />
    );
  }

  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const paginas = Math.max(1, Math.ceil(total / porPagina));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes diarios"
        subtitle={
          total === 0
            ? 'Todavía no hay reportes en este proyecto'
            : `${total} ${total === 1 ? 'reporte' : 'reportes'}`
        }
      >
        <Button variant="outline" size="sm" onClick={() => setAreasAbierto(true)}>
          <MapPin className="mr-2 h-4 w-4" /> Áreas
        </Button>
        <Button size="sm" onClick={() => setVista({ modo: 'nuevo' })}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo reporte
        </Button>
      </PageHeader>

      {/* Filtros encima de la tarjeta, como el resto de las listas. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Buscar por número, trabajo, atrasos…"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          />
        </div>
        <Select value={mes} onValueChange={(v) => { setMes(v); setPagina(1); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>{etiquetaMes(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={autor} onValueChange={(v) => { setAutor(v); setPagina(1); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Quién reportó" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los ingenieros</SelectItem>
            {autores.map(([id, nombre]) => (
              <SelectItem key={id} value={String(id)}>{nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState onRetry={cargar} />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            {/* Escritorio: tabla. Móvil: tarjetas. */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clima</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hrs. perd.</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calif.</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ayud.</TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Áreas</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fotos</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reportó</TableHead>
                  </TableRow>
                </TableHeader>
                {cargando ? (
                  <TableSkeleton rows={6} columns={8} />
                ) : (
                  <TableBody>
                    {filas.map((f) => (
                      <TableRow
                        key={f.id}
                        className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                        onClick={() => setVista({ modo: 'detalle', id: f.id })}
                      >
                        <TableCell className="px-4 py-3 text-center text-sm">
                          <span className="block font-medium text-foreground">{fechaCorta(f.fecha)}</span>
                          <span className="block text-xs text-muted-foreground">{diaDeLaSemana(f.fecha)}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <Badge variant="outline" className={clasesClima(f.clima)}>{f.clima}</Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm">
                          <Horas valor={f.horas_perdidas} />
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm tabular-nums text-slate-700">
                          {f.personal_calificado}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm tabular-nums text-slate-700">
                          {f.ayudantes}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-slate-700">
                          {f.areas.length ? f.areas.join(', ') : <span className="text-slate-300">—</span>}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm tabular-nums text-muted-foreground">
                          {f.fotos}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm text-muted-foreground">
                          {f.creador_nombre}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                )}
              </Table>
              {!cargando && filas.length === 0 && (
                <EmptyState
                  title="Sin reportes"
                  description="Cuando el ingeniero mande su primer reporte diario, aparecerá aquí."
                />
              )}
            </div>

            <div className="md:hidden">
              {cargando ? (
                <div className="p-4"><TableSkeleton rows={4} columns={2} /></div>
              ) : filas.length === 0 ? (
                <EmptyState
                  title="Sin reportes"
                  description="Cuando el ingeniero mande su primer reporte diario, aparecerá aquí."
                />
              ) : (
                filas.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setVista({ modo: 'detalle', id: f.id })}
                    className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50/60"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span>
                        <span className="block font-medium">{fechaCorta(f.fecha)}</span>
                        <span className="block text-xs text-muted-foreground">{diaDeLaSemana(f.fecha)}</span>
                      </span>
                      <Badge variant="outline" className={clasesClima(f.clima)}>{f.clima}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground tabular-nums">
                      <span>{f.personal_calificado} calif. · {f.ayudantes} ayud.</span>
                      {Number(f.horas_perdidas ?? 0) > 0 && (
                        <span className="font-semibold text-warning">
                          {Number(f.horas_perdidas)} h perdidas
                        </span>
                      )}
                      <span>{f.fotos} fotos</span>
                    </div>
                    {f.areas.length > 0 && (
                      <div className="mt-1 text-sm text-slate-700">{f.areas.join(', ')}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Paginación fuera de la tarjeta, como SolicitudesPagination. */}
          {total > 0 && (
            <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">Mostrando {desde}–{hasta} de {total}</span>
                <Select
                  value={String(porPagina)}
                  onValueChange={(v) => { setPorPagina(Number(v)); setPagina(1); }}
                >
                  <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAMANOS.map((t) => (
                      <SelectItem key={t} value={String(t)}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="hidden sm:inline">por página</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" className="h-8"
                  disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span className="min-w-[100px] px-2 text-center text-sm tabular-nums">
                  Página {pagina} de {paginas}
                </span>
                <Button
                  variant="outline" size="sm" className="h-8"
                  disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AreasDialog
        projectId={projectId}
        abierto={areasAbierto}
        onCerrar={() => setAreasAbierto(false)}
        onCambios={cargar}
      />
    </div>
  );
}
