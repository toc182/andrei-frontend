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
 *
 * Filtrar y ordenar ocurre EN EL NAVEGADOR, no en el servidor, igual que en
 * Solicitudes: un filtro de encabezado que solo mirara la página cargada
 * mentiría sobre lo que hay. Por eso se pide el mes entero de una vez. El mes
 * arranca en el actual, que es lo que acota el tamaño de esa carga.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, MapPin, ArrowLeft } from 'lucide-react';
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
import { SortableHeader } from '@/components/SortableHeader';
import {
  applyColumnFilters, getSortComparator,
  type ColumnFilters, type SortDirection, type SortState,
} from '@/components/sortableHeaderUtils';
import ReporteForm from './reportes/ReporteForm';
import ReporteDetalle from './reportes/ReporteDetalle';
import AreasDialog from './reportes/AreasDialog';
import {
  type Reporte, type ReporteFila,
  clasesClima, diaDeLaSemana, etiquetaMes, fechaCorta, hoyYMD,
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

/** Tope de la carga. El backend admite hasta 2000; un mes nunca se acerca. */
const TOPE = 2000;

/** El mes en curso, en YYYY-MM. Es el filtro por defecto de la lista. */
const MES_ACTUAL = hoyYMD().slice(0, 7);


/** Las horas perdidas resaltan solo cuando las hay. */
function Horas({ valor }: { valor: string | null }) {
  const n = valor ? Number(valor) : 0;
  if (!n) return <span className="text-slate-300">—</span>;
  return <span className="font-semibold text-warning tabular-nums">{n}</span>;
}

export default function ProjectReportes({ projectId }: Props) {
  const [vista, setVista] = useState<Vista>({ modo: 'lista' });
  const [filas, setFilas] = useState<ReporteFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [mes, setMes] = useState(MES_ACTUAL);
  const [meses, setMeses] = useState<string[]>([]);
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [areasAbierto, setAreasAbierto] = useState(false);
  const [numeroPrevisto, setNumeroPrevisto] = useState<string | null>(null);

  const cambiarOrden = (column: string, direction: SortDirection | null) => {
    setSortState(direction ? { column, direction } : { column: null, direction: null });
  };

  const cambiarFiltro = (column: string, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [column]: values }));
  };

  // La búsqueda se queda en el servidor: mira dentro de "qué se hizo" y
  // "atrasos", que no viajan en la fila de la lista y no se podrían buscar aquí.
  const cargar = useCallback(() => {
    setCargando(true);
    setError(false);
    api
      .get(`/proyecto-reportes/${projectId}`, {
        params: {
          q: busqueda || undefined,
          mes: mes === 'todos' ? undefined : mes,
          limit: TOPE,
        },
      })
      .then((r) => setFilas(r.data.data ?? []))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [projectId, busqueda, mes]);

  useEffect(() => {
    if (vista.modo === 'lista') cargar();
  }, [vista.modo, cargar]);

  useEffect(() => {
    api
      .get(`/proyecto-reportes/${projectId}/meses`)
      .then((r) => setMeses(r.data.data ?? []))
      .catch(() => setMeses([]));
  }, [projectId, vista.modo]);

  // Cualquier cambio de filtro u orden devuelve a la primera página: quedarse
  // en la página 7 de un resultado que ahora tiene dos filas se ve como un error.
  useEffect(() => {
    setPagina(1);
  }, [busqueda, mes, sortState, columnFilters, porPagina]);

  // El mes en curso siempre está en la lista aunque todavía no tenga reportes;
  // si no, el selector arrancaría en blanco en un proyecto recién empezado.
  const opcionesMes = Array.from(new Set([MES_ACTUAL, ...meses])).sort().reverse();

  // Los valores que ofrece cada filtro salen de lo filtrado por las DEMÁS
  // columnas, para no ofrecer opciones que no darían ninguna fila.
  const excluyendo = (columna: string) =>
    applyColumnFilters(
      filas,
      Object.fromEntries(Object.entries(columnFilters).filter(([k]) => k !== columna)),
    );
  const valoresClima = [...new Set(excluyendo('clima').map((f) => f.clima))].sort();
  const valoresAutor = [...new Set(excluyendo('creador_nombre').map((f) => f.creador_nombre))].sort();

  const comparador = getSortComparator(sortState);
  const visiblesTodas = applyColumnFilters(filas, columnFilters);
  const ordenadas = comparador ? [...visiblesTodas].sort(comparador) : visiblesTodas;

  if (vista.modo === 'nuevo' || vista.modo === 'editar') {
    const editando = vista.modo === 'editar' ? vista.reporte : undefined;
    const volver = () =>
      setVista(editando ? { modo: 'detalle', id: editando.id } : { modo: 'lista' });
    const titulo = editando
      ? `Corregir ${editando.numero}`
      : numeroPrevisto
        ? `Nuevo reporte diario - ${numeroPrevisto}`
        : 'Nuevo reporte diario';
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={volver}
            aria-label={editando ? 'Volver al reporte' : 'Volver a reportes'}
            className="-ml-2 h-8 w-8 shrink-0 self-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader title={titulo} />
        </div>
        <ReporteForm
          projectId={projectId}
          reporte={editando}
          onCancelar={volver}
          onListo={volver}
          onNumeroPrevisto={setNumeroPrevisto}
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

  // Paginación en el navegador, sobre lo ya filtrado y ordenado.
  const total = ordenadas.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaSegura = Math.min(pagina, paginas);
  const inicio = (paginaSegura - 1) * porPagina;
  const visibles = ordenadas.slice(inicio, inicio + porPagina);
  const desde = total === 0 ? 0 : inicio + 1;
  const hasta = Math.min(inicio + porPagina, total);

  // "No hay nada" y "no hay nada CON ESTOS FILTROS" no se dicen igual, y con el
  // mes en curso por defecto lo segundo va a pasar seguido.
  const hayFiltros =
    busqueda !== ''
    || mes !== 'todos'
    || Object.values(columnFilters).some((v) => v.length > 0);
  const vacioTitulo = hayFiltros ? 'Sin resultados' : 'Sin reportes';
  const vacioTexto = hayFiltros
    ? 'Ningún reporte coincide con lo que buscas. Prueba con otro mes o quita los filtros.'
    : 'Cuando el ingeniero mande su primer reporte diario, aparecerá aquí.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes diarios"
        subtitle={
          total === 0
            ? hayFiltros
              ? 'Ningún reporte coincide con los filtros'
              : 'Todavía no hay reportes en este proyecto'
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
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {/* Quién reportó ya no vive aquí: es un filtro del encabezado de la
            tabla, como en Solicitudes. El mes se queda porque además acota
            cuántos reportes se traen de una vez. */}
        {/* Cambiar de mes cambia el conjunto entero, así que los filtros de
            columna del mes anterior dejan de tener sentido: un ingeniero que
            no reportó en el mes nuevo escondería todas las filas. */}
        <Select value={mes} onValueChange={(v) => { setMes(v); setColumnFilters({}); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {opcionesMes.map((m) => (
              <SelectItem key={m} value={m}>{etiquetaMes(m)}</SelectItem>
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
                    {/* Solo Fecha, Clima y Reportó llevan control: son por las que
                        se busca un reporte. El resto son cifras que se leen en la
                        fila, no criterios de búsqueda. Instrucción de Ivan. */}
                    <SortableHeader
                      columnKey="fecha" label="Fecha" type="numeric" align="center"
                      className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      sortState={sortState} onSortChange={cambiarOrden}
                    />
                    <SortableHeader
                      columnKey="clima" label="Clima" type="discrete" align="center"
                      className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      sortState={sortState} onSortChange={cambiarOrden}
                      uniqueValues={valoresClima}
                      activeFilters={columnFilters.clima ?? valoresClima}
                      onFilterChange={cambiarFiltro}
                    />
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hrs. perd.</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calif.</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ayud.</TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Áreas</TableHead>
                    <TableHead className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fotos</TableHead>
                    <SortableHeader
                      columnKey="creador_nombre" label="Reportó" type="discrete" align="center"
                      className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      sortState={sortState} onSortChange={cambiarOrden}
                      uniqueValues={valoresAutor}
                      activeFilters={columnFilters.creador_nombre ?? valoresAutor}
                      onFilterChange={cambiarFiltro}
                    />
                  </TableRow>
                </TableHeader>
                {cargando ? (
                  <TableSkeleton rows={6} columns={8} />
                ) : (
                  <TableBody>
                    {visibles.map((f) => (
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
              {!cargando && total === 0 && (
                <EmptyState title={vacioTitulo} description={vacioTexto} />
              )}
            </div>

            <div className="md:hidden">
              {cargando ? (
                <div className="p-4"><TableSkeleton rows={4} columns={2} /></div>
              ) : total === 0 ? (
                <EmptyState title={vacioTitulo} description={vacioTexto} />
              ) : (
                visibles.map((f) => (
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
                <Select value={String(porPagina)} onValueChange={(v) => setPorPagina(Number(v))}>
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
                  disabled={paginaSegura <= 1} onClick={() => setPagina(paginaSegura - 1)}
                >
                  Anterior
                </Button>
                <span className="min-w-[100px] px-2 text-center text-sm tabular-nums">
                  Página {paginaSegura} de {paginas}
                </span>
                <Button
                  variant="outline" size="sm" className="h-8"
                  disabled={paginaSegura >= paginas} onClick={() => setPagina(paginaSegura + 1)}
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
