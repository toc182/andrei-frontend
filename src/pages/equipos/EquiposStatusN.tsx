/**
 * Página de Status de Equipos - Migrada a Shadcn/ui
 */

import { useState, useEffect } from 'react';
import api from '../../services/api';
import logo from '../../assets/logo.png';
import cocpLogo from '../../assets/LogoCOCPfondoblanco.png';
import type { EquipoExtended, ApiResponse } from '@/types';

// Shell components
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { ErrorState, TableSkeleton } from '@/components/shell/states';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Loader2 } from 'lucide-react';

interface EquipoWithStatus extends EquipoExtended {
  ubicacion?: string;
  ultima_revision?: string;
  proyecto?: string;
  responsable?: string;
  observaciones_status?: string;
}

interface StatusFormData {
  estado: string;
  proyecto: string;
  responsable: string;
  rata_mes: string;
  observaciones_status: string;
}

interface EstadoBadgeInfo {
  label: string;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
}

export default function EquiposStatusN() {
  const [equiposPinellas, setEquiposPinellas] = useState<EquipoWithStatus[]>([]);
  const [equiposCOCP, setEquiposCOCP] = useState<EquipoWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState<EquipoWithStatus | null>(null);
  const [statusFormOpen, setStatusFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<StatusFormData>({
    estado: '',
    proyecto: '',
    responsable: '',
    rata_mes: '',
    observaciones_status: '',
  });

  const getEstadoBadgeVariant = (estado?: string): EstadoBadgeInfo => {
    const estadoLower = (estado || '').toLowerCase();
    if (estadoLower.includes('operacion') || estadoLower.includes('operativo')) {
      return { label: 'En Operación', variant: 'default' };
    }
    if (estadoLower.includes('standby')) {
      return { label: 'Standby', variant: 'secondary' };
    }
    if (estadoLower.includes('mantenimiento')) {
      return { label: 'En Mantenimiento', variant: 'outline' };
    }
    if (estadoLower.includes('fuera')) {
      return { label: 'Fuera de Servicio', variant: 'destructive' };
    }
    return { label: 'En Operación', variant: 'default' };
  };

  const loadEquiposStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get<ApiResponse<EquipoExtended[]>>('/equipos');
      if (response.data.success && response.data.data) {
        const equiposConStatus: EquipoWithStatus[] = response.data.data.map((equipo) => ({
          ...equipo,
          ubicacion: equipo.proyecto || 'No especificada',
          ultima_revision: equipo.updated_at,
          estado: equipo.estado || 'en_operacion',
        }));
        setEquiposPinellas(equiposConStatus.filter((e) => e.owner === 'Pinellas'));
        setEquiposCOCP(equiposConStatus.filter((e) => e.owner === 'COCP'));
        setLastUpdate(new Date());
      } else {
        setError('Error al cargar estatus de equipos');
      }
    } catch (err) {
      console.error('Error loading equipos status:', err);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquiposStatus();
    const interval = setInterval(loadEquiposStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatLastUpdate = (date?: Date | string | null): string => {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(dateObj)
      .replace(/\s/g, '-')
      .replace('sept', 'sep');
  };

  const handleRowClick = (equipo: EquipoWithStatus) => {
    setSelectedEquipo(equipo);
    setDetailsOpen(true);
  };

  const handleOpenStatusForm = () => {
    setFormData({
      estado: selectedEquipo?.estado || 'en_operacion',
      proyecto: selectedEquipo?.ubicacion || '',
      responsable: selectedEquipo?.responsable || '',
      rata_mes: selectedEquipo?.rata_mes?.toString() || '',
      observaciones_status: selectedEquipo?.observaciones_status || '',
    });
    setStatusFormOpen(true);
    setDetailsOpen(false);
  };

  const handleFormChange = (name: keyof StatusFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipo) return;
    setIsSubmitting(true);
    try {
      await api.put(`/equipos/${selectedEquipo.id}/status`, formData);
      await loadEquiposStatus();
      setStatusFormOpen(false);
      setSelectedEquipo(null);
    } catch (err) {
      console.error('Error al actualizar status:', err);
      setError('Error al actualizar el status del equipo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTable = (equipos: EquipoWithStatus[]) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-[150px]">Estado</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead className="w-[150px]">Última Act.</TableHead>
            </TableRow>
          </TableHeader>
          {loading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : (
            <TableBody>
              {equipos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay equipos registrados
                  </TableCell>
                </TableRow>
              ) : (
                equipos.map((equipo) => {
                  const estadoInfo = getEstadoBadgeVariant(equipo.estado);
                  return (
                    <TableRow
                      key={equipo.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(equipo)}
                    >
                      <TableCell className="font-medium">
                        {equipo.codigo || 'Sin código'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium">{equipo.descripcion}</div>
                          <div className="text-sm text-muted-foreground">
                            {equipo.marca} {equipo.modelo}
                          </div>
                          {equipo.ano && (
                            <div className="text-xs text-muted-foreground">{equipo.ano}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={estadoInfo.variant}>{estadoInfo.label}</Badge>
                      </TableCell>
                      <TableCell>{equipo.ubicacion || 'No especificada'}</TableCell>
                      <TableCell className="text-sm">
                        {equipo.updated_at
                          ? formatLastUpdate(new Date(equipo.updated_at))
                          : formatLastUpdate(lastUpdate)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          )}
        </Table>
      </CardContent>
    </Card>
  );

  if (error && !statusFormOpen) {
    return (
      <ErrorState
        title="Error al cargar estados de equipos"
        description={error}
        onRetry={loadEquiposStatus}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={loadEquiposStatus} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-center">
          <img src={logo} alt="Pinellas Logo" className="h-8 object-contain" />
        </div>
        {renderTable(equiposPinellas)}
      </div>

      <div className="space-y-3 mt-8">
        <div className="flex justify-center">
          <img src={cocpLogo} alt="COCP Logo" className="h-8 object-contain" />
        </div>
        {renderTable(equiposCOCP)}
      </div>

      {/* Modal de Detalles */}
      <AppDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        size="simple"
        title="Detalles del Equipo"
        footer={
          <Button onClick={handleOpenStatusForm}>Actualizar Status</Button>
        }
      >
        <div className="space-y-3 text-sm">
          {[
            ['Descripción', selectedEquipo?.descripcion],
            ['Marca', selectedEquipo?.marca],
            ['Modelo', selectedEquipo?.modelo],
            ['Año', selectedEquipo?.ano || 'No especificado'],
            ['Ubicación', selectedEquipo?.ubicacion || 'No especificada'],
            ['Responsable', selectedEquipo?.responsable || 'No asignado'],
            ['Rata Mensual', selectedEquipo?.rata_mes
              ? `$${parseFloat(selectedEquipo.rata_mes.toString()).toLocaleString()}`
              : 'No especificado'],
            ['Propietario', selectedEquipo?.owner],
            ['Observaciones', selectedEquipo?.observaciones || 'Sin observaciones'],
            ['Última Act.', selectedEquipo?.ultima_revision
              ? formatLastUpdate(new Date(selectedEquipo.ultima_revision))
              : 'Sin registro'],
          ].map(([label, value]) => (
            <div key={String(label)} className="grid grid-cols-3 gap-2">
              <span className="font-medium text-muted-foreground">{label}:</span>
              <span className="col-span-2">{String(value ?? '')}</span>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2">
            <span className="font-medium text-muted-foreground">Estado:</span>
            <span className="col-span-2">
              {selectedEquipo && (
                <Badge variant={getEstadoBadgeVariant(selectedEquipo.estado).variant}>
                  {getEstadoBadgeVariant(selectedEquipo.estado).label}
                </Badge>
              )}
            </span>
          </div>
        </div>
      </AppDialog>

      {/* Modal Formulario de Status */}
      <AppDialog
        open={statusFormOpen}
        onOpenChange={setStatusFormOpen}
        size="simple"
        title="Actualizar Status del Equipo"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusFormOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" form="status-form" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </>
        }
      >
        {error && statusFormOpen && (
          <Alert variant="error" title={error} className="mb-4" />
        )}

        <form id="status-form" onSubmit={handleFormSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm font-semibold">
            {selectedEquipo?.codigo || 'Sin código'} — {selectedEquipo?.descripcion}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Estado</label>
            <Select
              value={formData.estado}
              onValueChange={(value) => handleFormChange('estado', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en_operacion">En Operación</SelectItem>
                <SelectItem value="standby">Standby</SelectItem>
                <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ubicación/Proyecto</label>
            <Input
              value={formData.proyecto}
              onChange={(e) => handleFormChange('proyecto', e.target.value)}
              placeholder="Proyecto donde se encuentra el equipo"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Responsable</label>
            <Input
              value={formData.responsable}
              onChange={(e) => handleFormChange('responsable', e.target.value)}
              placeholder="Persona responsable del equipo"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Rata Mensual</label>
            <Input
              type="number"
              step="0.01"
              value={formData.rata_mes}
              onChange={(e) => handleFormChange('rata_mes', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Observaciones</label>
            <Textarea
              rows={3}
              value={formData.observaciones_status}
              onChange={(e) => handleFormChange('observaciones_status', e.target.value)}
              placeholder="Observaciones sobre el status actual del equipo..."
            />
          </div>
        </form>
      </AppDialog>
    </div>
  );
}
