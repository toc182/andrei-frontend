/**
 * RequisicionesGeneral Component
 * Vista consolidada de todas las requisiciones de todos los proyectos
 * Accesible desde el sidebar principal
 */

import { useState, useEffect, ReactNode } from 'react';
import {
  Plus,
  FileText,
  Check,
  X,
  Clock,
  Search,
  Settings,
  Archive,
  LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Shell components
import { PageHeader } from '@/components/shell/PageHeader';
import { StatCard } from '@/components/shell/StatCard';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { EmptyState, TableSkeleton } from '@/components/shell/states';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatMoney } from '../utils/formatters';
import RequisicionForm from '../components/forms/RequisicionForm';
import type { Requisicion, RequisicionItem, Project } from '@/types';

type EstadoRequisicion =
  | 'pendiente'
  | 'en_cotizacion'
  | 'por_aprobar'
  | 'aprobada'
  | 'pagada'
  | 'rechazada';

interface HistorialItem {
  estado_anterior?: EstadoRequisicion;
  estado_nuevo: EstadoRequisicion;
  created_at: string;
  comentario?: string;
  usuario_nombre: string;
}

interface HistorialData {
  requisicion: Requisicion | null;
  items: RequisicionItem[];
  historial: HistorialItem[];
}

interface BadgeConfig {
  className: string;
  label: string;
  icon: LucideIcon;
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getEstadoBadge = (estado: string): ReactNode => {
  const variants: Record<string, BadgeConfig> = {
    pendiente: { className: 'bg-warning/10 text-warning border-warning/30 border', label: 'Pendiente', icon: Clock },
    en_cotizacion: { className: 'bg-info/10 text-info border-info/30 border', label: 'En Cotizacion', icon: Search },
    por_aprobar: { className: 'bg-info/10 text-info border-info/30 border', label: 'Por Aprobar', icon: FileText },
    aprobada: { className: 'bg-success/10 text-success border-success/30 border', label: 'Aprobada', icon: Check },
    pagada: { className: 'bg-success/10 text-success border-success/30 border', label: 'Pagada', icon: Check },
    rechazada: { className: 'bg-error/10 text-error border-error/30 border', label: 'Rechazada', icon: X },
  };

  const config = variants[estado] || { className: 'bg-slate-100 text-slate-600 border-slate-200 border', label: estado, icon: Clock };
  const Icon = config.icon;

  return (
    <Badge className={`flex items-center gap-1 w-fit ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

const getValidTransitions = (currentState: string): string[] => {
  const transitions: Record<string, string[]> = {
    pendiente: ['en_cotizacion', 'por_aprobar', 'rechazada'],
    en_cotizacion: ['por_aprobar', 'pendiente', 'rechazada'],
    por_aprobar: ['aprobada', 'rechazada', 'pendiente'],
    aprobada: ['pagada', 'rechazada'],
    pagada: [],
    rechazada: ['pendiente'],
  };
  return transitions[currentState] || [];
};

const estadoLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  en_cotizacion: 'En Cotizacion',
  por_aprobar: 'Por Aprobar',
  aprobada: 'Aprobada',
  pagada: 'Pagada',
  rechazada: 'Rechazada',
};

export default function RequisicionesGeneral() {
  const { user, hasPermission, isAdminOrCoAdmin } = useAuth();
  const canManageRequisicion = (req: Requisicion) =>
    isAdminOrCoAdmin ||
    hasPermission('requisiciones_editar_todas') ||
    req.solicitante_id === user?.id;

  const [requisiciones, setRequisiciones] = useState<Requisicion[]>([]);
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterEstado, setFilterEstado] = useState('all');
  const [filterProyecto, setFilterProyecto] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [editingRequisicion, setEditingRequisicion] = useState<Requisicion | null>(null);
  const [existingItems, setExistingItems] = useState<RequisicionItem[]>([]);

  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [estadoRequisicion, setEstadoRequisicion] = useState<Requisicion | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [comentarioEstado, setComentarioEstado] = useState('');
  const [changingEstado, setChangingEstado] = useState(false);

  const [showHistorial, setShowHistorial] = useState(false);
  const [historialRequisicion, setHistorialRequisicion] = useState<Requisicion | null>(null);
  const [historialData, setHistorialData] = useState<HistorialData>({
    requisicion: null,
    items: [],
    historial: [],
  });

  const [showArchivarModal, setShowArchivarModal] = useState(false);
  const [archivarLoading, setArchivarLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterEstado]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = filterEstado === 'archivadas' ? '?archivadas=true' : '';
      const [reqRes, projRes] = await Promise.all([
        api.get(`/requisiciones${params}`),
        api.get('/projects'),
      ]);
      if (reqRes.data.success) setRequisiciones(reqRes.data.requisiciones);
      if (projRes.data.success) setProyectos(projRes.data.proyectos || projRes.data.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar las requisiciones');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequisiciones = requisiciones.filter((req) => {
    if (filterEstado !== 'archivadas' && filterEstado !== 'all' && req.estado !== filterEstado)
      return false;
    if (filterProyecto !== 'all' && req.project_id !== parseInt(filterProyecto)) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        req.numero_requisicion?.toLowerCase().includes(search) ||
        req.proveedor?.toLowerCase().includes(search) ||
        req.proyecto_nombre?.toLowerCase().includes(search) ||
        req.descripcion?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const stats = {
    total: requisiciones.length,
    porAprobar: requisiciones.filter((r) => r.estado === 'por_aprobar').length,
    pagadas: requisiciones.filter((r) => r.estado === 'pagada').length,
    montoTotal: requisiciones.reduce((sum, r) => sum + (parseFloat(String(r.monto_total)) || 0), 0),
  };

  const handleNewRequisicion = () => setShowProjectSelector(true);

  const handleProjectSelected = (projectId: string) => {
    setSelectedProjectId(parseInt(projectId));
    setShowProjectSelector(false);
    setEditingRequisicion(null);
    setExistingItems([]);
    setShowForm(true);
  };

  const handleSaveRequisicion = async (data: Record<string, unknown>) => {
    if (editingRequisicion) {
      await api.put(`/requisiciones/${editingRequisicion.id}`, data);
    } else {
      await api.post('/requisiciones', data);
    }
    setShowForm(false);
    setEditingRequisicion(null);
    setSelectedProjectId(null);
    loadData();
  };

  const handleEditRequisicion = async (requisicion: Requisicion) => {
    try {
      const response = await api.get(`/requisiciones/${requisicion.id}`);
      if (response.data.success) {
        setSelectedProjectId(requisicion.project_id);
        setEditingRequisicion(response.data.requisicion);
        setExistingItems(response.data.items || []);
        setShowForm(true);
      }
    } catch (err) {
      console.error('Error loading requisicion:', err);
    }
  };

  const handleArchivar = async () => {
    if (!historialRequisicion) return;
    try {
      setArchivarLoading(true);
      await api.patch(`/requisiciones/${historialRequisicion.id}/archivar`);
      await loadData();
      setShowArchivarModal(false);
      setShowHistorial(false);
      setHistorialRequisicion(null);
      setHistorialData({ requisicion: null, items: [], historial: [] });
    } catch (err: unknown) {
      console.error('Error archivando requisicion:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || 'Error al archivar la requisicion');
    } finally {
      setArchivarLoading(false);
    }
  };

  const handleOpenEstadoModal = (requisicion: Requisicion) => {
    setEstadoRequisicion(requisicion);
    setNuevoEstado('');
    setComentarioEstado('');
    setShowEstadoModal(true);
  };

  const handleChangeEstado = async () => {
    if (!nuevoEstado || !estadoRequisicion) return;
    try {
      setChangingEstado(true);
      await api.patch(`/requisiciones/${estadoRequisicion.id}/estado`, {
        estado: nuevoEstado,
        comentario: comentarioEstado,
      });
      setShowEstadoModal(false);
      loadData();
    } catch (err: unknown) {
      console.error('Error changing estado:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || 'Error al cambiar estado');
    } finally {
      setChangingEstado(false);
    }
  };

  const handleShowHistorial = async (requisicion: Requisicion) => {
    try {
      const response = await api.get(`/requisiciones/${requisicion.id}`);
      if (response.data.success) {
        setHistorialData({
          requisicion: response.data.requisicion,
          items: response.data.items || [],
          historial: response.data.historial || [],
        });
        setHistorialRequisicion(requisicion);
        setShowHistorial(true);
      }
    } catch (err) {
      console.error('Error loading historial:', err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisiciones"
        subtitle="Vista consolidada de todos los proyectos"
      >
        <Button onClick={handleNewRequisicion}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Requisicion
        </Button>
      </PageHeader>

      {error && <Alert variant="error" title={error} />}

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={String(stats.total)}
          accent="navy"
        />
        <StatCard
          label="Por Aprobar"
          value={String(stats.porAprobar)}
          accent="warning"
        />
        <StatCard
          label="Pagadas"
          value={String(stats.pagadas)}
          accent="success"
        />
        <StatCard
          label="Monto Total"
          value={formatMoney(stats.montoTotal)}
          accent="teal"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Buscar por numero, proveedor, proyecto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterProyecto} onValueChange={setFilterProyecto}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.nombre_corto || p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(estadoLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
            <SelectItem value="archivadas">Archivadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-slate-200 hover:bg-slate-200">
                <TableHead className="w-[100px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Numero</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proyecto</TableHead>
                <TableHead className="hidden sm:table-cell px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proveedor</TableHead>
                <TableHead className="text-right w-[100px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</TableHead>
                <TableHead className="w-[120px] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</TableHead>
              </TableRow>
            </TableHeader>
            {loading ? (
              <TableSkeleton rows={6} columns={5} />
            ) : filteredRequisiciones.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      title="No se encontraron requisiciones"
                      description="Intenta ajustar los filtros o crea una nueva requisicion"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {filteredRequisiciones.map((req) => (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                    onClick={() => handleShowHistorial(req)}
                  >
                    <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                      <div>{req.numero_requisicion}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(req.fecha_solicitud)}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="text-xs bg-muted px-2 py-1 rounded w-fit">
                        {req.proyecto_nombre}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                        {req.proveedor}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell px-4 py-3 text-sm text-slate-700">
                      {req.proveedor}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm font-medium tabular-nums text-slate-700">
                      {formatMoney(req.monto_total)}
                    </TableCell>
                    <TableCell className="px-4 py-3">{getEstadoBadge(req.estado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
      </Card>

      {/* Project Selector Modal */}
      <AppDialog
        open={showProjectSelector}
        onOpenChange={setShowProjectSelector}
        size="confirm"
        title="Seleccionar Proyecto"
        description="Selecciona el proyecto para la nueva requisicion"
      >
        <Select onValueChange={handleProjectSelected}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un proyecto" />
          </SelectTrigger>
          <SelectContent>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.nombre_corto || p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AppDialog>

      {/* Requisicion Form Modal */}
      {showForm && selectedProjectId && (
        <RequisicionForm
          projectId={selectedProjectId}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingRequisicion(null);
            setSelectedProjectId(null);
          }}
          onSave={handleSaveRequisicion}
          editingRequisicion={editingRequisicion}
          existingItems={existingItems}
        />
      )}

      {/* Estado Change Modal */}
      <AppDialog
        open={showEstadoModal}
        onOpenChange={setShowEstadoModal}
        size="simple"
        title="Cambiar Estado"
        description={`Requisicion: ${estadoRequisicion?.numero_requisicion}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEstadoModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangeEstado}
              disabled={!nuevoEstado || changingEstado}
            >
              {changingEstado ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Estado actual</Label>
            <div className="mt-1">
              {estadoRequisicion && getEstadoBadge(estadoRequisicion.estado)}
            </div>
          </div>
          <div>
            <Label>Nuevo estado</Label>
            <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {estadoRequisicion &&
                  getValidTransitions(estadoRequisicion.estado).map((estado) => (
                    <SelectItem key={estado} value={estado}>
                      {estadoLabels[estado]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Comentario (opcional)</Label>
            <Textarea
              value={comentarioEstado}
              onChange={(e) => setComentarioEstado(e.target.value)}
              placeholder="Agregar un comentario..."
              className="mt-1"
            />
          </div>
        </div>
      </AppDialog>

      {/* History Modal */}
      <AppDialog
        open={showHistorial}
        onOpenChange={setShowHistorial}
        size="standard"
        title="Detalle de Requisicion"
        description={`${historialRequisicion?.numero_requisicion} — ${historialRequisicion?.proveedor}`}
      >
        <div className="space-y-4">
          {/* Edit button in title area — rendered as top action */}
          {historialRequisicion &&
            ['pendiente', 'en_cotizacion'].includes(historialRequisicion.estado) &&
            canManageRequisicion(historialRequisicion) && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowHistorial(false);
                    handleEditRequisicion(historialRequisicion);
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>
            )}

          {historialRequisicion?.descripcion && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Descripción</div>
              <div className="font-medium">{historialRequisicion.descripcion}</div>
            </div>
          )}

          {historialData.items.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">
                Detalle ({historialData.items.length} items)
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">P.Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historialData.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.descripcion}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.cantidad} {item.unidad}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(item.precio_unitario_estimado)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(
                            (item.cantidad || 0) * (item.precio_unitario_estimado || 0),
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {historialRequisicion && (
            <div className="space-y-3">
              <h4 className="font-medium">Estado</h4>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>{getEstadoBadge(historialRequisicion.estado)}</div>
                {getValidTransitions(historialRequisicion.estado).length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowHistorial(false);
                      handleOpenEstadoModal(historialRequisicion);
                    }}
                  >
                    Cambiar Estado
                  </Button>
                )}
              </div>
            </div>
          )}

          {historialData.historial.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Historial de cambios</h4>
              <div className="space-y-2">
                {historialData.historial.map((h, idx) => (
                  <div key={idx} className="border rounded p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        {h.estado_anterior && (
                          <span className="text-muted-foreground">
                            {estadoLabels[h.estado_anterior]} →{' '}
                          </span>
                        )}
                        <span className="font-medium">{estadoLabels[h.estado_nuevo]}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(h.created_at)}
                      </span>
                    </div>
                    {h.comentario && (
                      <p className="text-muted-foreground mt-1">{h.comentario}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Por: {h.usuario_nombre}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historialRequisicion && (
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full text-muted-foreground hover:text-destructive hover:border-destructive"
                onClick={() => setShowArchivarModal(true)}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archivar Requisicion
              </Button>
            </div>
          )}
        </div>
      </AppDialog>

      {/* Confirmacion Archivar */}
      <AlertDialog open={showArchivarModal} onOpenChange={setShowArchivarModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar requisicion?</AlertDialogTitle>
            <AlertDialogDescription>
              {historialRequisicion && (
                <>
                  Se archivará <strong>{historialRequisicion.numero_requisicion}</strong>{' '}
                  ({historialRequisicion.proveedor} — {formatMoney(historialRequisicion.monto_total)}).
                  Podrá ser restaurada más adelante si es necesario.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivarLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchivar}
              disabled={archivarLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archivarLoading ? 'Archivando...' : 'Si, Archivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
