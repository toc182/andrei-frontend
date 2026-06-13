// Cotizaciones — purchasing quote pool. Two tabs: "Por solicitud" (one
// row per request) and "Por proveedor" (one row per supplier offer).
// Client-side sort/filter/pagination, mirroring SolicitudesPagoGeneral.

import { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, ErrorState } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { TableSkeleton } from '@/components/shell';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import api from '@/services/api';
import {
  getSortComparator,
  applyColumnFilters,
} from '@/components/sortableHeaderUtils';
import type {
  SortState,
  SortDirection,
  ColumnFilters,
} from '@/components/sortableHeaderUtils';
import type { Cotizacion, CotizacionOfertaFlat } from '@/types/api';
import { TIPO_LABEL, proyectoLabel } from './shared';
import { CotizacionesSolicitudTable } from './components/CotizacionesSolicitudTable';
import { OfertasProveedorTable } from './components/OfertasProveedorTable';
import { CotizacionFormDialog } from './dialogs/CotizacionFormDialog';
import { CotizacionDetailDialog } from './dialogs/CotizacionDetailDialog';
import {
  OfertaDetailDialog,
  type OfertaDetailData,
} from './dialogs/OfertaDetailDialog';
import { SolicitudesPagination } from '../solicitudes/components/SolicitudesPagination';

interface ProjectOption {
  id: number;
  nombre: string;
  nombre_corto?: string | null;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// Derived keys (tipo_label, proyecto, fecha) so SortableHeader/getSortComparator
// and applyColumnFilters operate on stable per-row values.
type SolView = Cotizacion & { tipo_label: string; proyecto: string; fecha: string };
type ProvView = CotizacionOfertaFlat & {
  tipo_label: string;
  proyecto: string;
  fecha: string;
  monto_num: number;
};

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [ofertas, setOfertas] = useState<CotizacionOfertaFlat[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [tab, setTab] = useState('solicitud');
  const [search, setSearch] = useState('');

  // Per-tab sort/filter
  const [sortSol, setSortSol] = useState<SortState>({ column: null, direction: null });
  const [filtersSol, setFiltersSol] = useState<ColumnFilters>({});
  const [sortProv, setSortProv] = useState<SortState>({ column: null, direction: null });
  const [filtersProv, setFiltersProv] = useState<ColumnFilters>({});

  // Pagination (per tab)
  const [pageSize, setPageSize] = useState(25);
  const [pageSol, setPageSol] = useState(1);
  const [pageProv, setPageProv] = useState(1);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [ofertaDetail, setOfertaDetail] = useState<OfertaDetailData | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(false);
    try {
      const [cotRes, ofRes, projRes] = await Promise.all([
        api.get('/cotizaciones'),
        api.get('/cotizaciones/ofertas'),
        api.get('/projects'),
      ]);
      setCotizaciones(cotRes.data.data ?? []);
      setOfertas(ofRes.data.data ?? []);
      setProjects(projRes.data.proyectos ?? projRes.data.data ?? []);
    } catch (err) {
      console.error('Error loading cotizaciones:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Reset to page 1 on filter/search/sort/size change
  useEffect(() => {
    setPageSol(1);
  }, [search, sortSol, filtersSol, pageSize]);
  useEffect(() => {
    setPageProv(1);
  }, [search, sortProv, filtersProv, pageSize]);

  const handleSortSol = (column: string, direction: SortDirection | null) =>
    setSortSol(direction ? { column, direction } : { column: null, direction: null });
  const handleFilterSol = (column: string, values: string[]) =>
    setFiltersSol((prev) => ({ ...prev, [column]: values }));
  const handleSortProv = (column: string, direction: SortDirection | null) =>
    setSortProv(direction ? { column, direction } : { column: null, direction: null });
  const handleFilterProv = (column: string, values: string[]) =>
    setFiltersProv((prev) => ({ ...prev, [column]: values }));

  // --- "Por solicitud" derived rows ---
  const solViews: SolView[] = useMemo(
    () =>
      cotizaciones.map((c) => ({
        ...c,
        tipo_label: c.tipo ? TIPO_LABEL[c.tipo] : '',
        proyecto: proyectoLabel(c.proyecto_nombre, c.ambito),
        fecha: c.created_at,
      })),
    [cotizaciones],
  );

  const solSearched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return solViews;
    return solViews.filter(
      (r) =>
        r.descripcion.toLowerCase().includes(q) ||
        r.proyecto.toLowerCase().includes(q),
    );
  }, [solViews, search]);

  const solExcluding = (col: string) =>
    applyColumnFilters(
      solSearched,
      Object.fromEntries(Object.entries(filtersSol).filter(([k]) => k !== col)),
    );
  const uniqueTiposSol = [...new Set(solExcluding('tipo_label').map((r) => r.tipo_label))].sort();
  const uniqueProyectosSol = [...new Set(solExcluding('proyecto').map((r) => r.proyecto))].sort();

  const solFinal = useMemo(() => {
    const filtered = applyColumnFilters(solSearched, filtersSol);
    const cmp = getSortComparator(sortSol);
    const sorted = cmp ? [...filtered].sort(cmp) : filtered;
    return sorted;
  }, [solSearched, filtersSol, sortSol]);

  const solTotal = solFinal.length;
  const solPages = Math.max(1, Math.ceil(solTotal / pageSize));
  const solSafePage = Math.min(pageSol, solPages);
  const solStart = (solSafePage - 1) * pageSize;
  const solPageRows = solFinal.slice(solStart, solStart + pageSize);

  // --- "Por proveedor" derived rows ---
  const provViews: ProvView[] = useMemo(
    () =>
      ofertas.map((o) => ({
        ...o,
        tipo_label: o.tipo ? TIPO_LABEL[o.tipo] : '',
        proyecto: proyectoLabel(o.proyecto_nombre, o.ambito),
        fecha: o.created_at,
        monto_num: o.monto != null ? Number(o.monto) : 0,
      })),
    [ofertas],
  );

  const provSearched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return provViews;
    return provViews.filter(
      (r) =>
        r.proveedor.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.proyecto.toLowerCase().includes(q),
    );
  }, [provViews, search]);

  const provExcluding = (col: string) =>
    applyColumnFilters(
      provSearched,
      Object.fromEntries(Object.entries(filtersProv).filter(([k]) => k !== col)),
    );
  const uniqueProveedores = [...new Set(provExcluding('proveedor').map((r) => r.proveedor))].sort();
  const uniqueTiposProv = [...new Set(provExcluding('tipo_label').map((r) => r.tipo_label))].sort();
  const uniqueProyectosProv = [...new Set(provExcluding('proyecto').map((r) => r.proyecto))].sort();

  const provFinal = useMemo(() => {
    const filtered = applyColumnFilters(provSearched, filtersProv);
    const cmp = getSortComparator(sortProv);
    const sorted = cmp ? [...filtered].sort(cmp) : filtered;
    return sorted;
  }, [provSearched, filtersProv, sortProv]);

  const provTotal = provFinal.length;
  const provPages = Math.max(1, Math.ceil(provTotal / pageSize));
  const provSafePage = Math.min(pageProv, provPages);
  const provStart = (provSafePage - 1) * pageSize;
  const provPageRows = provFinal.slice(provStart, provStart + pageSize);

  const openOfertaFromFlat = (row: CotizacionOfertaFlat) =>
    setOfertaDetail({
      id: row.id,
      cotizacion_id: row.cotizacion_id,
      proveedor: row.proveedor,
      monto: row.monto,
      nota: row.nota,
      created_at: row.created_at,
      agregado_por_nombre: row.agregado_por_nombre,
      descripcion: row.descripcion,
      tipo: row.tipo,
      proyecto_nombre: row.proyecto_nombre,
      ambito: row.ambito,
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotizaciones"
        subtitle="Las solicitudes de cotización y todos los precios de proveedores, en un solo lugar."
      >
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva cotización
        </Button>
      </PageHeader>

      <Input
        placeholder="Buscar por descripción, proveedor o proyecto…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {error ? (
        <ErrorState description="No se pudieron cargar las cotizaciones." onRetry={loadAll} />
      ) : loading ? (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableSkeleton rows={6} columns={4} />
          </Table>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 w-full justify-center">
            <TabsTrigger value="solicitud">Por solicitud</TabsTrigger>
            <TabsTrigger value="proveedor">Por proveedor</TabsTrigger>
          </TabsList>

          <TabsContent value="solicitud" className="space-y-4">
            <CotizacionesSolicitudTable
              rows={solPageRows}
              sortState={sortSol}
              onSortChange={handleSortSol}
              columnFilters={filtersSol}
              onFilterChange={handleFilterSol}
              uniqueTipos={uniqueTiposSol}
              uniqueProyectos={uniqueProyectosSol}
              onRowClick={(row) => setDetailId(row.id)}
            />
            <SolicitudesPagination
              totalItems={solTotal}
              showingFrom={solTotal === 0 ? 0 : solStart + 1}
              showingTo={Math.min(solStart + pageSize, solTotal)}
              currentPage={solSafePage}
              totalPages={solPages}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPageSol}
              onPageSizeChange={setPageSize}
            />
          </TabsContent>

          <TabsContent value="proveedor" className="space-y-4">
            <OfertasProveedorTable
              rows={provPageRows}
              sortState={sortProv}
              onSortChange={handleSortProv}
              columnFilters={filtersProv}
              onFilterChange={handleFilterProv}
              uniqueProveedores={uniqueProveedores}
              uniqueTipos={uniqueTiposProv}
              uniqueProyectos={uniqueProyectosProv}
              onRowClick={openOfertaFromFlat}
            />
            <SolicitudesPagination
              totalItems={provTotal}
              showingFrom={provTotal === 0 ? 0 : provStart + 1}
              showingTo={Math.min(provStart + pageSize, provTotal)}
              currentPage={provSafePage}
              totalPages={provPages}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPageProv}
              onPageSizeChange={setPageSize}
            />
          </TabsContent>
        </Tabs>
      )}

      <CotizacionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        projects={projects}
        onSaved={loadAll}
      />

      <CotizacionDetailDialog
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
        cotizacionId={detailId}
        projects={projects}
        onChanged={loadAll}
      />

      <OfertaDetailDialog
        open={!!ofertaDetail}
        onOpenChange={(o) => !o && setOfertaDetail(null)}
        oferta={ofertaDetail}
        onChanged={loadAll}
        onOpenParent={(cotizacionId) => {
          setOfertaDetail(null);
          setDetailId(cotizacionId);
        }}
      />
    </div>
  );
}
