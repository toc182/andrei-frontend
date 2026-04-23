/**
 * ProjectRequisiciones Component
 * Main container for requisition management within a project
 * Features: List requisitions, create, edit, change status, track history
 */

import { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Check,
  X,
  Clock,
  Search,
  AlertCircle,
  Settings,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/shell/Alert';
import { AppDialog } from '@/components/shell/AppDialog';
import { StatCard } from '@/components/shell/StatCard';
import { EmptyState, TableSkeleton } from '@/components/shell/states';
import { Card, CardContent } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { formatMoney } from '../../utils/formatters';
import RequisicionForm from '../../components/forms/RequisicionForm';

type EstadoRequisicion =
  | 'pendiente'
  | 'en_cotizacion'
  | 'por_aprobar'
  | 'aprobada'
  | 'pagada'
  | 'rechazada';

interface Requisicion {
  id: number;
  numero: string;
  fecha: string;
  proveedor: string;
  concepto?: string;
  monto_total: string | number;
  subtotal?: string | number;
  itbms?: string | number;
  estado: EstadoRequisicion;
  categoria_nombre?: string;
  categoria_color?: string;
}

interface RequisicionItem {
  id?: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  subtotal: number;
  aplica_itbms: boolean;
  itbms?: number;
  total: number;
}

interface HistorialItem {
  id: number;
  estado_anterior?: EstadoRequisicion;
  estado_nuevo: EstadoRequisicion;
  created_at: string;
  comentario?: string;
  usuario_nombre?: string;
}

interface HistoryData {
  requisicion: Requisicion | null;
  historial: HistorialItem[];
  items: RequisicionItem[];
}

interface EstadoBadgeConfig {
  className: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ProjectRequisicionesProps {
  projectId: number;
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

// Badge variants for each status
const getEstadoBadge = (estado: EstadoRequisicion): ReactNode => {
  const variants: Record<EstadoRequisicion, EstadoBadgeConfig> = {
    pendiente: { className: 'bg-warning/10 text-warning border-warning/30 border', label: 'Pendiente', icon: Clock },
    en_cotizacion: { className: 'bg-info/10 text-info border-info/30 border', label: 'En Cotizacion', icon: Search },
    por_aprobar: { className: 'bg-info/10 text-info border-info/30 border', label: 'Por Aprobar', icon: AlertCircle },
    aprobada: { className: 'bg-success/10 text-success border-success/30 border', label: 'Aprobada', icon: Check },
    pagada: { className: 'bg-success/10 text-success border-success/30 border', label: 'Pagada', icon: Check },
    rechazada: { className: 'bg-error/10 text-error border-error/30 border', label: 'Rechazada', icon: X },
  };

  const config = variants[estado] || {
    className: 'bg-slate-100 text-slate-600 border-slate-200 border',
    label: estado,
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <Badge className={`flex items-center gap-1 w-fit ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// Valid state transitions
const getValidTransitions = (
  currentState: EstadoRequisicion,
): EstadoRequisicion[] => {
  const transitions: Record<EstadoRequisicion, EstadoRequisicion[]> = {
    pendiente: ['en_cotizacion', 'por_aprobar', 'rechazada'],
    en_cotizacion: ['por_aprobar', 'pendiente', 'rechazada'],
    por_aprobar: ['aprobada', 'rechazada', 'pendiente'],
    aprobada: ['pagada', 'rechazada'],
    pagada: [],
    rechazada: ['pendiente'],
  };
  return transitions[currentState] || [];
};

const estadoLabels: Record<EstadoRequisicion, string> = {
  pendiente: 'Pendiente',
  en_cotizacion: 'En Cotizacion',
  por_aprobar: 'Por Aprobar',
  aprobada: 'Aprobada',
  pagada: 'Pagada',
  rechazada: 'Rechazada',
};

export default function ProjectRequisiciones({
  projectId,
}: ProjectRequisicionesProps) {
  const { user, hasPermission, isAdminOrCoAdmin } = useAuth();
  const canManage = !!user;
  const canManageRequisicion = (req: Requisicion) =>
    isAdminOrCoAdmin ||
    hasPermission('requisiciones_editar_todas') ||
    req.solicitante_id === user?.id;

  const [requisiciones, setRequisiciones] = useState<Requisicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRequisicion, setEditingRequisicion] =
    useState<Requisicion | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRequisicion, setSelectedRequisicion] =
    useState<Requisicion | null>(null);
  const [newStatus, setNewStatus] = useState<EstadoRequisicion | ''>('');
  const [statusComment, setStatusComment] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData>({
    requisicion: null,
    historial: [],
    items: [],
  });
  const [filterEstado, setFilterEstado] = useState('all');
  const [editingItems, setEditingItems] = useState<RequisicionItem[]>([]);
  const [showArchivarModal, setShowArchivarModal] = useState(false);
  const [archivarLoading, setArchivarLoading] = useState(false);

  useEffect(() => {
    loadRequisiciones();
  }, [projectId, filterEstado]);

  const loadRequisiciones = async () => {
    try {
      setLoading(true);
      setError(null);
      // Si el filtro es "archivadas", pedir las archivadas al backend
      const params = filterEstado === 'archivadas' ? '?archivadas=true' : '';
      const response = await api.get(
        `/requisiciones/project/${projectId}${params}`,
      );
      if (response.data.success) {
        setRequisiciones(response.data.requisiciones || []);
      }
    } catch (err) {
      console.error('Error loading requisiciones:', err);
      setError('Error al cargar las requisiciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      if (editingRequisicion) {
        await api.put(`/requisiciones/${editingRequisicion.id}`, data);
      } else {
        await api.post('/requisiciones', data);
      }
      await loadRequisiciones();
      setShowForm(false);
      setEditingRequisicion(null);
    } catch (err) {
      console.error('Error saving requisicion:', err);
      throw err;
    }
  };

  const handleArchivar = async () => {
    if (!historyData.requisicion) return;

    try {
      setArchivarLoading(true);
      await api.patch(`/requisiciones/${historyData.requisicion.id}/archivar`);
      await loadRequisiciones();
      setShowArchivarModal(false);
      setShowHistoryModal(false);
      setHistoryData({ requisicion: null, historial: [], items: [] });
    } catch (err) {
      console.error('Error archivando requisicion:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(
        apiError.response?.data?.message || 'Error al archivar la requisicion',
      );
    } finally {
      setArchivarLoading(false);
    }
  };

  const openStatusModal = (requisicion: Requisicion) => {
    setSelectedRequisicion(requisicion);
    setNewStatus('');
    setStatusComment('');
    setShowStatusModal(true);
  };

  const handleStatusChange = async () => {
    if (!newStatus || !selectedRequisicion) return;

    try {
      setStatusLoading(true);
      await api.patch(`/requisiciones/${selectedRequisicion.id}/estado`, {
        estado: newStatus,
        comentario: statusComment,
      });
      await loadRequisiciones();
      setShowStatusModal(false);
      setSelectedRequisicion(null);
    } catch (err) {
      console.error('Error changing status:', err);
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || 'Error al cambiar el estado');
    } finally {
      setStatusLoading(false);
    }
  };

  const openHistoryModal = async (requisicion: Requisicion) => {
    try {
      const response = await api.get(`/requisiciones/${requisicion.id}`);
      if (response.data.success) {
        setHistoryData({
          requisicion: response.data.requisicion,
          historial: response.data.historial || [],
          items: response.data.items || [],
        });
        setShowHistoryModal(true);
      }
    } catch (err) {
      console.error('Error loading history:', err);
      setError('Error al cargar el historial');
    }
  };

  const openEditForm = async (requisicion: Requisicion) => {
    try {
      const response = await api.get(`/requisiciones/${requisicion.id}`);
      if (response.data.success) {
        setEditingRequisicion(response.data.requisicion);
        setEditingItems(response.data.items || []);
        setShowForm(true);
      }
    } catch (err) {
      console.error('Error loading requisicion:', err);
      setError('Error al cargar la requisicion');
    }
  };

  // Filter requisiciones
  const filteredRequisiciones = requisiciones.filter((req) => {
    if (filterEstado === 'all') return true;
    if (filterEstado === 'archivadas') return true; // Ya viene filtrado del backend
    if (filterEstado === 'activas')
      return !['pagada', 'rechazada'].includes(req.estado);
    if (filterEstado === 'finalizadas')
      return ['pagada', 'rechazada'].includes(req.estado);
    return req.estado === filterEstado;
  });

  // Calculate summary stats
  const stats = {
    total: requisiciones.length,
    pendientes: requisiciones.filter((r) => r.estado === 'pendiente').length,
    porAprobar: requisiciones.filter((r) => r.estado === 'por_aprobar').length,
    aprobadas: requisiciones.filter((r) => r.estado === 'aprobada').length,
    pagadas: requisiciones.filter((r) => r.estado === 'pagada').length,
    montoTotal: requisiciones.reduce(
      (sum, r) => sum + parseFloat(String(r.monto_total || 0)),
      0,
    ),
    montoPagado: requisiciones
      .filter((r) => r.estado === 'pagada')
      .reduce((sum, r) => sum + parseFloat(String(r.monto_total || 0)), 0),
  };

  if (error && !loading) {
    return <Alert variant="error" title={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Requisiciones" value={String(stats.total)} accent="navy" />
        <StatCard label="Por Aprobar" value={String(stats.porAprobar)} accent="warning" />
        <StatCard label="Pagadas" value={String(stats.pagadas)} accent="success" />
        <StatCard label="Total Pagado" value={formatMoney(stats.montoPagado)} accent="teal" />
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="activas">Activas</SelectItem>
              <SelectItem value="finalizadas">Finalizadas</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="por_aprobar">Por Aprobar</SelectItem>
              <SelectItem value="aprobada">Aprobadas</SelectItem>
              <SelectItem value="pagada">Pagadas</SelectItem>
              <SelectItem value="rechazada">Rechazadas</SelectItem>
              <SelectItem value="archivadas">Archivadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Requisicion
          </Button>
        )}
      </div>

      {/* Requisiciones List - Cards for mobile */}
      <div className="md:hidden space-y-3">
        {!loading && filteredRequisiciones.length === 0 ? (
          <EmptyState
            title="No hay requisiciones"
            description="Crea la primera requisicion para este proyecto"
          />
        ) : (
          filteredRequisiciones.map((req) => (
            <Card
              key={req.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => openHistoryModal(req)}
            >
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold">{req.numero}</div>
                    <div className="text-sm text-muted-foreground">
                      {req.proveedor}
                    </div>
                  </div>
                  {getEstadoBadge(req.estado)}
                </div>
                <div className="text-lg font-bold mb-2">
                  {formatMoney(req.monto_total)}
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  {formatDate(req.fecha)}
                  {req.categoria_nombre && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: req.categoria_color }}
                      />
                      {req.categoria_nombre}
                    </span>
                  )}
                </div>
                {req.concepto && (
                  <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {req.concepto}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Requisiciones List - Table for desktop */}
      <div className="hidden md:block">
        <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-slate-50 hover:bg-slate-50">
                  <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Numero</TableHead>
                  <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</TableHead>
                  <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proveedor</TableHead>
                  <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monto</TableHead>
                  <TableHead className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              {loading ? (
                <TableSkeleton rows={5} columns={7} />
              ) : filteredRequisiciones.length === 0 ? (
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        title="No hay requisiciones"
                        description="Crea la primera requisicion para este proyecto"
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
                      onClick={() => openHistoryModal(req)}
                    >
                      <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                        {req.numero}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-slate-700">{formatDate(req.fecha)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div>
                          <div className="text-sm text-slate-700">{req.proveedor}</div>
                          {req.concepto && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {req.concepto}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {req.categoria_nombre ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: req.categoria_color }}
                            />
                            <span>{req.categoria_nombre}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm font-medium tabular-nums text-slate-700">
                        {formatMoney(req.monto_total)}
                      </TableCell>
                      <TableCell className="px-4 py-3">{getEstadoBadge(req.estado)}</TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div
                          className="flex gap-1 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Actions can be added here */}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              )}
            </Table>
        </Card>
      </div>

      {/* Requisicion Form Modal */}
      <RequisicionForm
        projectId={projectId}
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingRequisicion(null);
          setEditingItems([]);
        }}
        onSave={handleSave}
        editingRequisicion={editingRequisicion as any}
        existingItems={editingItems as any}
      />

      {/* Status Change Modal */}
      <AppDialog
        open={showStatusModal}
        onOpenChange={setShowStatusModal}
        size="simple"
        title="Cambiar Estado de Requisicion"
        description={
          selectedRequisicion
            ? `Requisicion: ${selectedRequisicion.numero}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowStatusModal(false)}
              disabled={statusLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={!newStatus || statusLoading}
            >
              {statusLoading ? 'Guardando...' : 'Confirmar Cambio'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Estado Actual</Label>
            <div>
              {selectedRequisicion &&
                getEstadoBadge(selectedRequisicion.estado)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newStatus">Nuevo Estado</Label>
            <Select
              value={newStatus}
              onValueChange={(v) => setNewStatus(v as EstadoRequisicion)}
            >
              <SelectTrigger id="newStatus">
                <SelectValue placeholder="Seleccione nuevo estado" />
              </SelectTrigger>
              <SelectContent>
                {selectedRequisicion &&
                  getValidTransitions(selectedRequisicion.estado).map(
                    (estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estadoLabels[estado]}
                      </SelectItem>
                    ),
                  )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="statusComment">Comentario (opcional)</Label>
            <Textarea
              id="statusComment"
              placeholder="Agregar un comentario sobre este cambio..."
              rows={3}
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
            />
          </div>

          {newStatus === 'pagada' && (
            <Alert
              variant="info"
              title="Al marcar como pagada, se registrara automaticamente como gasto del proyecto."
            />
          )}
        </div>
      </AppDialog>

      {/* History Modal */}
      <AppDialog
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        size="standard"
        title="Detalle de Requisicion"
        description={
          historyData.requisicion
            ? `${historyData.requisicion.numero} - ${historyData.requisicion.proveedor}`
            : undefined
        }
      >
        <div className="space-y-4 py-2">
          {/* Edit button when applicable */}
          {canManage &&
            historyData.requisicion &&
            ['pendiente', 'en_cotizacion'].includes(
              historyData.requisicion.estado,
            ) &&
            canManageRequisicion(historyData.requisicion) && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-0 hover:bg-muted"
                  onClick={() => {
                    setShowHistoryModal(false);
                    openEditForm(historyData.requisicion!);
                  }}
                  title="Editar requisición"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            )}

          {/* Requisicion Details */}
          {historyData.requisicion && (
            <div className="space-y-4">
              {/* Descripción */}
              {historyData.requisicion.concepto && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">
                    Descripción
                  </div>
                  <div className="font-medium">
                    {historyData.requisicion.concepto}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Subtotal
                  </div>
                  <div className="font-medium">
                    {formatMoney(historyData.requisicion.subtotal)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    ITBMS (7%)
                  </div>
                  <div className="font-medium">
                    {formatMoney(historyData.requisicion.itbms)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="font-medium text-lg">
                    {formatMoney(historyData.requisicion.monto_total)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Fecha</div>
                  <div className="font-medium">
                    {formatDate(historyData.requisicion.fecha)}
                  </div>
                </div>
                {historyData.requisicion.categoria_nombre && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Categoria
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            historyData.requisicion.categoria_color,
                        }}
                      />
                      <span>{historyData.requisicion.categoria_nombre}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Items List */}
              {historyData.items && historyData.items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">
                    Detalle ({historyData.items.length} items)
                  </h4>
                  <div className="space-y-2">
                    {historyData.items.map((item, index) => (
                      <div
                        key={item.id || index}
                        className="p-3 border rounded-lg text-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">
                              {item.descripcion}
                            </div>
                            <div className="text-muted-foreground">
                              {item.cantidad} {item.unidad} x{' '}
                              {formatMoney(item.precio_unitario)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div>{formatMoney(item.subtotal)}</div>
                            {item.aplica_itbms && (
                              <div className="text-xs text-muted-foreground">
                                +ITBMS: {formatMoney(item.itbms)}
                              </div>
                            )}
                            <div className="font-medium">
                              {formatMoney(item.total)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Estado Section */}
          {historyData.requisicion && (
            <div className="space-y-3">
              <h4 className="font-medium">Estado</h4>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getEstadoBadge(historyData.requisicion.estado)}
                </div>
                {canManage &&
                  getValidTransitions(historyData.requisicion.estado).length >
                    0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowHistoryModal(false);
                        openStatusModal(historyData.requisicion!);
                      }}
                    >
                      Cambiar Estado
                    </Button>
                  )}
              </div>
            </div>
          )}

          {/* History Timeline */}
          <div className="space-y-4">
            <h4 className="font-medium">Historial de Cambios</h4>
            {historyData.historial.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No hay historial de cambios
              </div>
            ) : (
              <div className="space-y-3">
                {historyData.historial.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 border rounded-lg"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.estado_anterior && (
                          <>
                            <Badge variant="outline">
                              {estadoLabels[item.estado_anterior]}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                          </>
                        )}
                        <Badge variant="default">
                          {estadoLabels[item.estado_nuevo]}
                        </Badge>
                      </div>
                      {item.comentario && (
                        <div className="text-sm text-muted-foreground">
                          {item.comentario}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {item.usuario_nombre && (
                          <span>{item.usuario_nombre} - </span>
                        )}
                        {formatDate(item.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Archivar Section */}
          {canManage &&
            historyData.requisicion &&
            canManageRequisicion(historyData.requisicion) && (
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

      {/* Modal de Confirmacion para Archivar */}
      <AppDialog
        open={showArchivarModal}
        onOpenChange={setShowArchivarModal}
        size="confirm"
        title="Archivar Requisicion"
        description="Esta accion archivara la requisicion. Podra ser restaurada mas adelante si es necesario."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowArchivarModal(false)}
              disabled={archivarLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchivar}
              disabled={archivarLoading}
            >
              {archivarLoading ? 'Archivando...' : 'Si, Archivar'}
            </Button>
          </>
        }
      >
        {historyData.requisicion && (
          <div className="py-2">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="font-medium">
                {historyData.requisicion.numero}
              </div>
              <div className="text-sm text-muted-foreground">
                {historyData.requisicion.proveedor}
              </div>
              <div className="text-sm">
                {formatMoney(historyData.requisicion.monto_total)}
              </div>
            </div>
          </div>
        )}
      </AppDialog>
    </div>
  );
}
