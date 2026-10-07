/**
 * La lista de requisiciones: la de un proyecto y la de todos (Compras).
 *
 * Dos pestañas, y nunca mezcladas (Ivan, 2026-10-02): Aprobadas, que es la de
 * siempre y va primero, y Por aprobar, que solo aparece a quien puede tener
 * alguna ahí —quien escribe requisiciones, quien aprueba las de un proyecto, o
 * un admin—. A Compras le sale solo la de aprobadas, sin pestañas.
 *
 * Patrón de las listas del sistema (FRONTEND_CONVENTIONS §10, como Órdenes de
 * compra): el buscador encima de la tabla, la tabla sola en su tarjeta y la
 * paginación debajo. Paginada en el servidor, como los reportes.
 *
 * La requisición se abre ENCIMA de la lista, que se queda montada y escondida:
 * al volver está como se dejó (Pagos hace igual).
 */
import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import api from '@/services/api';
import { Alert, EmptyState, PageHeader, TableSkeleton } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SolicitudesPagination } from '@/pages/solicitudes/components/SolicitudesPagination';
import { useAuth } from '@/context/AuthContext';
import { useCargaLenta } from '@/hooks/useCargaLenta';
import { useVolverAlSitio } from '@/hooks/useVolverAlSitio';
import { cn } from '@/lib/utils';
import RequisicionDetallePage from './RequisicionDetalle';
import RequisicionFormDialog from './RequisicionFormDialog';
import { diaDeMomento } from './formato';
import { PrioridadEtiqueta } from './etiquetas';
import type { PendientesRequisiciones, RequisicionFila } from './tipos';

const TAMANOS = [25, 50, 100];
const CABECERA = 'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

type Vista = 'aprobadas' | 'por_aprobar';

interface TablaProps {
  vista: Vista;
  proyectoId?: number;
  conProyecto: boolean;
  /** El filtro de Compras: solo las que tienen líneas pendientes. */
  conFiltroPendientes: boolean;
  recargar: number;
  onAbrir: (id: number) => void;
}

/** Una pestaña: su buscador, su tabla y su paginación, cada una con lo suyo. */
function TablaRequisiciones({ vista, proyectoId, conProyecto, conFiltroPendientes, recargar, onAbrir }: TablaProps) {
  const [filas, setFilas] = useState<RequisicionFila[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(25);
  const [buscar, setBuscar] = useState('');
  const [buscando, setBuscando] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(conFiltroPendientes);
  const [cargando, setCargando] = useState(true);
  const lenta = useCargaLenta(cargando);
  const [error, setError] = useState<string | null>(null);

  // Se busca cuando se deja de escribir, no en cada letra.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setBuscando(buscar.trim());
      setPagina(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [buscar]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const params: Record<string, string | number> = { vista, pagina, tamano };
    if (proyectoId) params.proyecto_id = proyectoId;
    if (buscando) params.buscar = buscando;
    if (conFiltroPendientes && soloPendientes) params.solo_pendientes = 'true';
    api
      .get('/requisiciones', { params })
      .then((res) => {
        if (!vivo) return;
        setFilas(res.data.data as RequisicionFila[]);
        setTotal(res.data.total as number);
        setError(null);
      })
      .catch(() => vivo && setError('No se pudieron cargar las requisiciones'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [vista, proyectoId, pagina, tamano, buscando, soloPendientes, conFiltroPendientes, recargar]);

  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const desde = (pagina - 1) * tamano;
  const columnas = conProyecto ? 5 : 4;
  const vacia =
    vista === 'por_aprobar'
      ? { titulo: 'No hay requisiciones por aprobar', texto: 'Las que se escriben esperan aquí hasta que las aprueban.' }
      : { titulo: 'Todavía no hay requisiciones aprobadas', texto: 'Una requisición aparece aquí cuando la aprueban.' };
  const sinCoincidencias = !!buscando || (conFiltroPendientes && soloPendientes);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Buscar por número o descripción..."
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          autoComplete="off"
          className="w-full sm:max-w-sm"
        />
        {conFiltroPendientes && (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`solo-pendientes-${vista}`}
              checked={soloPendientes}
              onCheckedChange={(v) => {
                setSoloPendientes(!!v);
                setPagina(1);
              }}
            />
            <Label htmlFor={`solo-pendientes-${vista}`} className="cursor-pointer text-sm font-normal">
              Mostrar solo las que tienen líneas pendientes
            </Label>
          </div>
        )}
      </div>

      {error && <Alert variant="error" title={error} />}

      {/* Teléfono: tarjetas. */}
      <div className={cn('space-y-3 md:hidden', cargando && !lenta && 'invisible')}>
        {!cargando && filas.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={sinCoincidencias ? 'Ninguna requisición coincide' : vacia.titulo}
            description={sinCoincidencias ? 'Prueba con otro número o descripción.' : vacia.texto}
          />
        ) : (
          filas.map((f) => (
            <Card key={f.id} className="cursor-pointer p-4" onClick={() => onAbrir(f.id)}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-foreground">{f.numero}</p>
                <PrioridadEtiqueta prioridad={f.prioridad} />
              </div>
              <p className="mt-1 text-sm text-slate-700">{f.descripcion}</p>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {conProyecto ? `${f.proyecto_nombre} · ` : ''}
                {diaDeMomento(f.created_at)}
              </p>
            </Card>
          ))
        )}
      </div>

      <div className={cn('hidden md:block', cargando && !lenta && 'invisible')}>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className={cn(CABECERA, 'w-[130px]')}>Número</TableHead>
                {conProyecto && <TableHead className={cn(CABECERA, 'w-[150px]')}>Proyecto</TableHead>}
                <TableHead className={CABECERA}>Descripción</TableHead>
                <TableHead className={cn(CABECERA, 'w-[120px]')}>Fecha</TableHead>
                <TableHead className={cn(CABECERA, 'w-[140px]')}>Prioridad</TableHead>
              </TableRow>
            </TableHeader>
            {cargando && filas.length === 0 ? (
              <TableSkeleton rows={6} columns={columnas} />
            ) : (
              <TableBody>
                {filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnas} className="p-0">
                      <EmptyState
                        icon={ClipboardList}
                        title={sinCoincidencias ? 'Ninguna requisición coincide' : vacia.titulo}
                        description={sinCoincidencias ? 'Prueba con otro número o descripción.' : vacia.texto}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filas.map((f) => (
                    <TableRow
                      key={f.id}
                      className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                      onClick={() => onAbrir(f.id)}
                    >
                      <TableCell className="px-4 py-3 text-sm font-medium text-foreground">{f.numero}</TableCell>
                      {conProyecto && (
                        <TableCell className="truncate px-4 py-3 text-sm text-slate-700">{f.proyecto_nombre}</TableCell>
                      )}
                      <TableCell className="truncate px-4 py-3 text-sm text-slate-700">{f.descripcion}</TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums text-slate-700">{diaDeMomento(f.created_at)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <PrioridadEtiqueta prioridad={f.prioridad} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            )}
          </Table>
        </Card>
      </div>

      {total > 0 && (
        <SolicitudesPagination
          totalItems={total}
          showingFrom={desde + 1}
          showingTo={Math.min(desde + tamano, total)}
          currentPage={pagina}
          totalPages={totalPaginas}
          pageSize={tamano}
          pageSizeOptions={TAMANOS}
          onPageChange={setPagina}
          onPageSizeChange={(t) => {
            setTamano(t);
            setPagina(1);
          }}
        />
      )}
    </div>
  );
}

interface Props {
  /** Dentro de un proyecto; sin él, la de todos los proyectos. */
  proyectoId?: number;
  proyectoNombre?: string;
  onNavigate?: (view: string) => void;
  /** Una que se pidió abrir desde otra sección (Cotizaciones): se abre al entrar. */
  abrirAlEntrar?: number | null;
  onAbiertaAlEntrar?: () => void;
}

export default function RequisicionesLista({
  proyectoId,
  proyectoNombre,
  onNavigate,
  abrirAlEntrar = null,
  onAbiertaAlEntrar,
}: Props) {
  const { user, hasPermission } = useAuth();
  const esAdmin = user?.rol === 'admin' || user?.rol === 'co-admin';
  const [pendientes, setPendientes] = useState<PendientesRequisiciones | null>(null);
  const [aprobador, setAprobador] = useState<{ id: number | null; cargado: boolean }>({ id: null, cargado: false });
  const [pestana, setPestana] = useState<Vista>('aprobadas');
  const [abiertas, setAbiertas] = useState<Record<Vista, boolean>>({ aprobadas: true, por_aprobar: false });
  const [recargar, setRecargar] = useState(0);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [avisoAbierta, setAvisoAbierta] = useState<string[] | undefined>(undefined);
  const [formAbierto, setFormAbierto] = useState(false);

  const traerPendientes = useCallback(() => {
    api
      .get('/requisiciones/pendientes')
      .then((res) => setPendientes(res.data.data as PendientesRequisiciones))
      .catch(() => setPendientes(null));
  }, []);
  useEffect(() => traerPendientes(), [traerPendientes, recargar]);

  // Quién aprueba las de este proyecto: sin nadie, no se puede escribir una.
  useEffect(() => {
    if (!proyectoId) return;
    api
      .get(`/requisiciones/proyecto/${proyectoId}/ajustes`)
      .then((res) => setAprobador({ id: res.data.data.aprobador_id as number | null, cargado: true }))
      .catch(() => setAprobador({ id: null, cargado: true }));
  }, [proyectoId]);

  const puedeEscribir = !!proyectoId && hasPermission('requisiciones_crear');
  const apruebaAqui = proyectoId ? (pendientes?.aprueba_en ?? []).includes(proyectoId) : (pendientes?.aprueba_en.length ?? 0) > 0;
  const conPorAprobar = esAdmin || hasPermission('requisiciones_crear') || apruebaAqui;
  // El filtro de pendientes es la herramienta de Compras, en la de todos los
  // proyectos; arranca puesto, que es lo que Martina tiene que trabajar.
  const conFiltroPendientes = !proyectoId && !!user?.permissions?.requisiciones_atender;
  const faltaAprobador = !!proyectoId && aprobador.cargado && aprobador.id === null;

  const tapada = abierta !== null;
  const { ref: listaRef, salir } = useVolverAlSitio(tapada);
  const abrir = (id: number, aviso?: string[]) => {
    salir();
    setAvisoAbierta(aviso);
    setAbierta(id);
  };

  useEffect(() => {
    if (abrirAlEntrar === null) return;
    setAbierta(abrirAlEntrar);
    onAbiertaAlEntrar?.();
  }, [abrirAlEntrar, onAbiertaAlEntrar]);

  const cambiarPestana = (v: string) => {
    const vista = v as Vista;
    setPestana(vista);
    setAbiertas((a) => ({ ...a, [vista]: true }));
  };

  const tabla = (vista: Vista) => (
    <TablaRequisiciones
      vista={vista}
      proyectoId={proyectoId}
      conProyecto={!proyectoId}
      conFiltroPendientes={vista === 'aprobadas' && conFiltroPendientes}
      recargar={recargar}
      onAbrir={(id) => abrir(id)}
    />
  );

  return (
    <>
      {abierta !== null && (
        <RequisicionDetallePage
          key={abierta}
          requisicionId={abierta}
          volverA={pestana === 'por_aprobar' ? 'Requisiciones · Por aprobar' : 'Requisiciones'}
          avisoInicial={avisoAbierta}
          onVolver={() => setAbierta(null)}
          onCambio={() => {
            setRecargar((n) => n + 1);
            // El globito del menú vuelve a contar.
            window.dispatchEvent(new Event('requisicion-cambio'));
          }}
        />
      )}
      <div ref={listaRef} className={cn('space-y-6', tapada && 'hidden')}>
        <PageHeader
          title="Requisiciones"
          subtitle={proyectoId ? undefined : 'Vista consolidada de todos los proyectos'}
        >
          {puedeEscribir && (
            <Button onClick={() => setFormAbierto(true)} disabled={faltaAprobador}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva requisición
            </Button>
          )}
        </PageHeader>

        {puedeEscribir && faltaAprobador && (
          <Alert
            variant="warning"
            title="Falta quién aprueba las requisiciones de este proyecto"
            description="Se configura en Personal del proyecto."
            actions={
              esAdmin && onNavigate ? (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => onNavigate(`project-${proyectoId}-miembros`)}
                >
                  Ir a Personal del proyecto
                </Button>
              ) : undefined
            }
          />
        )}

        {conPorAprobar ? (
          <Tabs value={pestana} onValueChange={cambiarPestana}>
            <TabsList className="mb-6 w-full justify-center">
              <TabsTrigger value="aprobadas">Aprobadas</TabsTrigger>
              <TabsTrigger value="por_aprobar">Por aprobar</TabsTrigger>
            </TabsList>
            {abiertas.aprobadas && (
              <TabsContent value="aprobadas" forceMount className={cn(pestana !== 'aprobadas' && 'hidden')}>
                {tabla('aprobadas')}
              </TabsContent>
            )}
            {abiertas.por_aprobar && (
              <TabsContent value="por_aprobar" forceMount className={cn(pestana !== 'por_aprobar' && 'hidden')}>
                {tabla('por_aprobar')}
              </TabsContent>
            )}
          </Tabs>
        ) : (
          tabla('aprobadas')
        )}
      </div>

      {puedeEscribir && (
        <RequisicionFormDialog
          open={formAbierto}
          onOpenChange={setFormAbierto}
          proyectoId={proyectoId!}
          proyectoNombre={proyectoNombre}
          esAprobador={aprobador.id !== null && aprobador.id === user?.id}
          onListo={(id, sinSubir) => {
            setRecargar((n) => n + 1);
            window.dispatchEvent(new Event('requisicion-cambio'));
            // Recién escrita espera aprobación: al volver, que se vea donde está.
            if (!(aprobador.id !== null && aprobador.id === user?.id)) cambiarPestana('por_aprobar');
            abrir(id, sinSubir);
          }}
        />
      )}
    </>
  );
}
