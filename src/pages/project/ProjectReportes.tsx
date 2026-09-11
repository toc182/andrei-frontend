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
import { Plus, MapPin, ArrowLeft, Download, Loader2 } from 'lucide-react';
import api from '@/services/api';
import {
  EmptyState, ErrorState, PageHeader, TableSkeleton,
} from '@/components/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
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
  clasesClima, diaDelMes, diaDeLaSemana, etiquetaMes, mesCorto, hoyYMD,
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


/**
 * La fecha como un recuadro de calendario: banda navy con el mes y el año, el
 * día en grande y el día de la semana debajo.
 *
 * Son dos piezas apiladas, cada una con su propio borde, en vez de un marco
 * único por encima de las dos: el marco gris cruzaba la banda azul y la hacía
 * ver más angosta que el resto del cuadro. El borde de la banda es navy sobre
 * navy, o sea invisible, y las dos piezas miden lo mismo porque el borde va por
 * dentro del ancho (box-sizing: border-box).
 */
function CajaFecha({ fecha }: { fecha: string }) {
  return (
    <span className="flex w-[56px] flex-none flex-col tabular-nums">
      {/* La banda centra su texto con flex, no con relleno: así el mes queda a
          la misma distancia arriba y abajo por más que cambie la letra. */}
      <span className="flex h-[15px] items-center justify-center rounded-t border border-navy bg-navy text-[9px] font-semibold uppercase leading-none tracking-wide text-white">
        {mesCorto(fecha)}
      </span>
      <span className="flex flex-col items-center rounded-b border border-t-0 border-navy/30 bg-card pb-1 pt-1">
        <span className="text-base font-semibold leading-none text-navy">
          {diaDelMes(fecha)}
        </span>
        <span className="mt-0.5 text-[10px] capitalize leading-none text-muted-foreground">
          {diaDeLaSemana(fecha)}
        </span>
      </span>
    </span>
  );
}

/**
 * El texto del día, en una línea. Se corta en el último espacio antes del tope
 * para no partir una palabra, y se cierra con "..." para que se vea que sigue.
 */
function resumen(texto: string | null, tope = 120): string {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= tope) return limpio;
  const corte = limpio.slice(0, tope);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > tope * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}...`;
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
  const [bajando, setBajando] = useState<number | null>(null);

  // El PDF se pide con el token puesto y se abre desde memoria: un enlace
  // pelado llegaría sin autenticación y el servidor lo rechazaría. Es el
  // mismo camino que usa el botón del detalle.
  const descargarPdf = async (id: number) => {
    setBajando(id);
    try {
      const r = await api.get(`/proyecto-reportes/${projectId}/${id}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setBajando(null);
    }
  };

  const cambiarOrden = (column: string, direction: SortDirection | null) => {
    setSortState(direction ? { column, direction } : { column: null, direction: null });
  };

  const cambiarFiltro = (column: string, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [column]: values }));
  };

  // La búsqueda se queda en el servidor: mira dentro de "qué se hizo" completo,
  // "atrasos" y "novedades". La fila solo trae el arranque de "qué se hizo", así
  // que buscar aquí dejaría fuera lo que diga más abajo del texto.
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
    // El numero va de subtitulo y no pegado al titulo: el h1 de PageHeader
    // recorta con truncate, asi que en un telefono "Nuevo reporte diario -
    // RD-PP300-260908" se cortaba a media palabra en vez de bajar de linea.
    const titulo = editando ? 'Corregir reporte' : 'Nuevo reporte diario';
    const subtitulo = editando ? editando.numero : numeroPrevisto;
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
          <PageHeader title={titulo} subtitle={subtitulo} />
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
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                    {/* Solo Fecha, Elaborado por y Clima llevan control: son por
                        las que se busca un reporte. El código y el texto del día
                        se leen en la fila. Instrucción de Ivan.

                        Los anchos generosos valen de lg para arriba, que es
                        donde sobra espacio; el resto se lo lleva Trabajo
                        ejecutado, así que al angostar encoge esa y no las otras.
                        Por debajo de lg se van las dos — Trabajo ejecutado
                        recortado a nada no dice nada, y Clima no cabe junto a lo
                        demás. Fecha, Código, Elaborado por y PDF no se van nunca:
                        el PDF menos que ninguna, que es una acción. */}
                    <SortableHeader
                      columnKey="fecha" label="Fecha" type="numeric" align="center"
                      className="w-[90px] px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      sortState={sortState} onSortChange={cambiarOrden}
                    />
                    <TableHead className="whitespace-nowrap px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[190px]">Código</TableHead>
                    <SortableHeader
                      columnKey="creador_nombre" label="Elaborado por" type="discrete" align="center"
                      className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:w-[230px]"
                      sortState={sortState} onSortChange={cambiarOrden}
                      uniqueValues={valoresAutor}
                      activeFilters={columnFilters.creador_nombre ?? valoresAutor}
                      onFilterChange={cambiarFiltro}
                    />
                    <SortableHeader
                      columnKey="clima" label="Clima" type="discrete" align="center"
                      className="hidden text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell lg:w-[160px]"
                      sortState={sortState} onSortChange={cambiarOrden}
                      uniqueValues={valoresClima}
                      activeFilters={columnFilters.clima ?? valoresClima}
                      onFilterChange={cambiarFiltro}
                    />
                    <TableHead className="hidden w-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">Trabajo ejecutado</TableHead>
                    <TableHead className="w-[64px] px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                {cargando ? (
                  /* Dos esqueletos porque la tabla cambia de columnas: de lg
                     para abajo se van Clima y Trabajo ejecutado, y uno de seis
                     columnas prometería dos que no están. */
                  <>
                    <TableSkeleton rows={6} columns={4} className="lg:hidden" />
                    <TableSkeleton rows={6} columns={6} className="hidden lg:table-row-group" />
                  </>
                ) : (
                  <TableBody>
                    {visibles.map((f) => (
                      <TableRow
                        key={f.id}
                        className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                        onClick={() => setVista({ modo: 'detalle', id: f.id })}
                      >
                        {/* Recuadro de calendario: banda navy con el mes y el
                            año, el día en grande y el día de la semana debajo.
                            La banda es lo que hace que la columna se encuentre
                            sola al bajar la vista. Opción B del mock. */}
                        <TableCell className="px-4 py-2 text-center">
                          <span className="mx-auto flex justify-center">
                            <CajaFecha fecha={f.fecha} />
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3 text-center text-sm tabular-nums text-slate-700">
                          {f.numero}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-sm text-muted-foreground">
                          {f.creador_nombre}
                        </TableCell>
                        <TableCell className="hidden px-4 py-3 text-center lg:table-cell">
                          <Badge variant="outline" className={clasesClima(f.clima)}>{f.clima}</Badge>
                        </TableCell>
                        <TableCell className="hidden w-full px-4 py-3 text-sm text-slate-700 lg:table-cell">
                          {resumen(f.que_se_hizo) || <span className="text-slate-300">—</span>}
                        </TableCell>
                        {/* El clic del botón no debe abrir el detalle: la fila
                            entera es un enlace y el PDF es otra acción. */}
                        <TableCell className="px-2 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-navy"
                            title={`Descargar el PDF de ${f.numero}`}
                            disabled={bajando === f.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              descargarPdf(f.id);
                            }}
                          >
                            {bajando === f.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4" />}
                            <span className="sr-only">Descargar PDF</span>
                          </Button>
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
                /* La tarjeta lleva lo mismo que la fila de la tabla. El botón
                   del PDF va FUERA del botón que abre el detalle: un botón
                   dentro de otro no es HTML válido. */
                visibles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/60"
                  >
                    <button
                      type="button"
                      onClick={() => setVista({ modo: 'detalle', id: f.id })}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <CajaFecha fecha={f.fecha} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium tabular-nums text-foreground">
                            {f.numero}
                          </span>
                          <Badge variant="outline" className={clasesClima(f.clima)}>{f.clima}</Badge>
                        </span>
                        {/* Sin el texto del día: la tarjeta se lee de un golpe y
                            entran más en la pantalla. El texto está en el detalle. */}
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {f.creador_nombre}
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-none text-muted-foreground hover:text-navy"
                      title={`Descargar el PDF de ${f.numero}`}
                      disabled={bajando === f.id}
                      onClick={() => descargarPdf(f.id)}
                    >
                      {bajando === f.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />}
                      <span className="sr-only">Descargar PDF</span>
                    </Button>
                  </div>
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
