/**
 * Página de Asignaciones de Equipos - Migrada a Shadcn/ui
 *
 * Gestiona las asignaciones de equipos a proyectos con:
 * - Dos tablas separadas (Alquiler y Propios)
 * - Formulario para crear/editar asignaciones
 * - Formulario para registrar uso (solo para alquiler)
 * - Modal de confirmación para eliminar
 * - Campos condicionales según tipo de uso
 * - Sin FontAwesome, sin CSS custom
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../../services/api'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Clock, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

// Schema para AsignacionForm
const asignacionSchema = z.object({
  equipo_id: z.string().min(1, 'Equipo es obligatorio'),
  cliente_id: z.string().min(1, 'Cliente es obligatorio'),
  proyecto_id: z.string().min(1, 'Proyecto es obligatorio'),
  responsable_id: z.string().optional().or(z.literal('')),
  fecha_inicio: z.string().min(1, 'Fecha de inicio es obligatoria'),
  fecha_fin: z.string().optional().or(z.literal('')),
  tipo_uso: z.enum(['propio', 'alquiler']),
  tipo_cobro: z.string().optional().or(z.literal('')),
  tarifa: z.coerce.number().optional().or(z.literal('')),
  incluye_operador: z.boolean(),
  costo_operador: z.coerce.number().optional().or(z.literal('')),
  incluye_combustible: z.boolean(),
  costo_combustible: z.coerce.number().optional().or(z.literal('')),
  ajuste_monto: z.coerce.number().optional().or(z.literal('')),
  motivo_ajuste: z.string().optional().or(z.literal('')),
  observaciones: z.string().optional().or(z.literal('')),
})

// Schema para RegistroUsoForm
const registroUsoSchema = z.object({
  fecha_inicio: z.string().min(1, 'Fecha es obligatoria'),
  fecha_fin: z.string().optional().or(z.literal('')),
  cantidad: z.coerce.number().min(0, 'Cantidad debe ser mayor a 0'),
  observaciones: z.string().optional().or(z.literal('')),
})

export default function AsignacionesEquiposN() {
  const [asignaciones, setAsignaciones] = useState({ alquiler: [], propios: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Estados para modales
  const [formOpen, setFormOpen] = useState(false)
  const [registroUsoOpen, setRegistroUsoOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedAsignacion, setSelectedAsignacion] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Datos para selects
  const [equipos, setEquipos] = useState([])
  const [equiposDisponibles, setEquiposDisponibles] = useState([])
  const [clientes, setClientes] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [registrosUso, setRegistrosUso] = useState([])

  // Form setup para asignaciones
  const asignacionForm = useForm({
    resolver: zodResolver(asignacionSchema),
    defaultValues: {
      equipo_id: '',
      cliente_id: '',
      proyecto_id: '',
      responsable_id: '',
      fecha_inicio: '',
      fecha_fin: '',
      tipo_uso: 'propio',
      tipo_cobro: '',
      tarifa: '',
      incluye_operador: false,
      costo_operador: '',
      incluye_combustible: false,
      costo_combustible: '',
      ajuste_monto: '',
      motivo_ajuste: '',
      observaciones: '',
    },
  })

  // Form setup para registro de uso
  const registroUsoForm = useForm({
    resolver: zodResolver(registroUsoSchema),
    defaultValues: {
      fecha_inicio: '',
      fecha_fin: '',
      cantidad: '',
      observaciones: '',
    },
  })

  // Watch tipo_uso para mostrar campos condicionales
  const tipoUso = asignacionForm.watch('tipo_uso')
  const incluyeOperador = asignacionForm.watch('incluye_operador')
  const incluyeCombustible = asignacionForm.watch('incluye_combustible')

  // Cargar asignaciones
  const loadAsignaciones = async () => {
    try {
      setLoading(true)
      const response = await api.get('/asignaciones')
      if (response.data.success) {
        const allAsignaciones = response.data.data
        const alquiler = allAsignaciones.filter((a) => a.tipo_uso === 'alquiler')
        const propios = allAsignaciones.filter((a) => a.tipo_uso === 'propio')
        setAsignaciones({ alquiler, propios })
      }
    } catch (error) {
      console.error('Error loading asignaciones:', error)
      setError('Error al cargar asignaciones')
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos iniciales para formularios
  const loadFormData = async (editingAsignacion = null) => {
    try {
      const [equiposRes, clientesRes, proyectosRes, asignacionesRes] = await Promise.all([
        api.get('/equipos'),
        api.get('/clientes'),
        api.get('/projects'),
        api.get('/asignaciones'),
      ])

      if (equiposRes.data.success) {
        const todosEquipos = equiposRes.data.data
        setEquipos(todosEquipos)

        // Filtrar equipos disponibles
        if (asignacionesRes.data.success) {
          const asignaciones = asignacionesRes.data.data
          const equiposAsignadosIds = asignaciones
            .filter((a) => !editingAsignacion || a.id !== editingAsignacion.id)
            .map((a) => a.equipo_id)

          const disponibles = todosEquipos.filter((e) => !equiposAsignadosIds.includes(e.id))
          setEquiposDisponibles(disponibles)
        } else {
          setEquiposDisponibles(todosEquipos)
        }
      }

      if (clientesRes.data.success) setClientes(clientesRes.data.clientes)
      if (proyectosRes.data.success) setProyectos(proyectosRes.data.proyectos)
    } catch (error) {
      console.error('Error loading form data:', error)
      setError('Error al cargar datos del formulario')
    }
  }

  // Cargar registros de uso
  const loadRegistrosUso = async (asignacionId) => {
    try {
      const response = await api.get(`/registro-uso/asignacion/${asignacionId}`)
      if (response.data.success) {
        setRegistrosUso(response.data.data)
      }
    } catch (error) {
      console.error('Error loading registros:', error)
    }
  }

  useEffect(() => {
    loadAsignaciones()
  }, [])

  // Handlers
  const handleNewAsignacion = async () => {
    await loadFormData()
    setSelectedAsignacion(null)
    asignacionForm.reset({
      equipo_id: '',
      cliente_id: '',
      proyecto_id: '',
      responsable_id: '',
      fecha_inicio: '',
      fecha_fin: '',
      tipo_uso: 'propio',
      tipo_cobro: '',
      tarifa: '',
      incluye_operador: false,
      costo_operador: '',
      incluye_combustible: false,
      costo_combustible: '',
      observaciones: '',
    })
    setFormOpen(true)
  }

  const handleEditAsignacion = async (asignacion) => {
    await loadFormData(asignacion)
    setSelectedAsignacion(asignacion)
    asignacionForm.reset({
      equipo_id: asignacion.equipo_id?.toString() || '',
      cliente_id: asignacion.cliente_id?.toString() || '',
      proyecto_id: asignacion.proyecto_id?.toString() || '',
      responsable_id: asignacion.responsable_id || '',
      fecha_inicio: asignacion.fecha_inicio ? asignacion.fecha_inicio.split('T')[0] : '',
      fecha_fin: asignacion.fecha_fin ? asignacion.fecha_fin.split('T')[0] : '',
      tipo_uso: asignacion.tipo_uso || 'propio',
      tipo_cobro: asignacion.tipo_cobro || '',
      tarifa: asignacion.tarifa || '',
      incluye_operador: asignacion.incluye_operador || false,
      costo_operador: asignacion.costo_operador || '',
      incluye_combustible: asignacion.incluye_combustible || false,
      costo_combustible: asignacion.costo_combustible || '',
      observaciones: asignacion.observaciones || '',
    })
    setFormOpen(true)
  }

  const handleRegistroUso = async (asignacion) => {
    setSelectedAsignacion(asignacion)
    await loadRegistrosUso(asignacion.id)
    registroUsoForm.reset({
      fecha_inicio: asignacion.fecha_inicio ? asignacion.fecha_inicio.split('T')[0] : '',
      fecha_fin: '',
      cantidad: '',
      observaciones: '',
    })
    setRegistroUsoOpen(true)
  }

  const handleAsignacionSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      let response
      if (selectedAsignacion) {
        response = await api.put(`/asignaciones/${selectedAsignacion.id}`, data)
      } else {
        response = await api.post('/asignaciones', data)
      }

      if (response.data.success) {
        await loadAsignaciones()
        setFormOpen(false)
        setSelectedAsignacion(null)
        asignacionForm.reset()
      } else {
        setError(response.data.message || 'Error al guardar la asignación')
      }
    } catch (error) {
      console.error('Error saving asignacion:', error)
      setError(error.response?.data?.message || 'Error al guardar')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegistroUsoSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      const dataToSend = {
        asignacion_id: selectedAsignacion.id,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: selectedAsignacion.tipo_cobro === 'hora' ? data.fecha_inicio : data.fecha_fin,
        cantidad: data.cantidad,
        observaciones: data.observaciones || null,
      }

      const response = await api.post('/registro-uso', dataToSend)

      if (response.data.success) {
        await loadRegistrosUso(selectedAsignacion.id)
        registroUsoForm.reset({
          fecha_inicio: selectedAsignacion.fecha_inicio
            ? selectedAsignacion.fecha_inicio.split('T')[0]
            : '',
          fecha_fin: '',
          cantidad: '',
          observaciones: '',
        })
      }
    } catch (error) {
      console.error('Error saving registro uso:', error)
      setError('Error al guardar el registro')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = () => {
    setDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedAsignacion) return

    setIsSubmitting(true)
    try {
      const response = await api.delete(`/asignaciones/${selectedAsignacion.id}`)
      if (response.data.success) {
        await loadAsignaciones()
        setDeleteOpen(false)
        setFormOpen(false)
        setSelectedAsignacion(null)
      }
    } catch (error) {
      console.error('Error deleting asignacion:', error)
      setError('Error al eliminar la asignación')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Renderizar tabla
  const renderTable = (asignacionesData, title, showRegistroBtn = false) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asignacionesData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No hay asignaciones
                  </TableCell>
                </TableRow>
              ) : (
                asignacionesData.map((asignacion) => (
                  <TableRow
                    key={asignacion.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      showRegistroBtn
                        ? handleRegistroUso(asignacion)
                        : handleEditAsignacion(asignacion)
                    }
                  >
                    <TableCell className="font-medium">
                      {asignacion.equipo_descripcion}
                    </TableCell>
                    <TableCell>
                      {asignacion.cliente_abreviatura || asignacion.cliente_nombre}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {showRegistroBtn && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRegistroUso(asignacion)
                            }}
                            title="Registrar Uso"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditAsignacion(asignacion)
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando asignaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end">
        <Button onClick={handleNewAsignacion}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Asignación
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tablas */}
      {renderTable(asignaciones.alquiler, 'Equipos en Alquiler', true)}
      {renderTable(asignaciones.propios, 'Equipos en Proyectos Propios', false)}

      {/* Formulario de Asignación */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAsignacion ? 'Editar Asignación' : 'Nueva Asignación de Equipo'}
            </DialogTitle>
          </DialogHeader>

          <Form {...asignacionForm}>
            <form
              onSubmit={asignacionForm.handleSubmit(handleAsignacionSubmit)}
              className="space-y-4"
            >
              {!selectedAsignacion && (
                <FormField
                  control={asignacionForm.control}
                  name="equipo_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar equipo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {equiposDisponibles.map((equipo) => (
                            <SelectItem key={equipo.id} value={equipo.id.toString()}>
                              {equipo.codigo} - {equipo.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedAsignacion && (
                <div className="rounded-md bg-muted p-3">
                  <span className="font-semibold">
                    Equipo:{' '}
                    {equipos.find((e) => e.id === selectedAsignacion.equipo_id)?.codigo} -{' '}
                    {equipos.find((e) => e.id === selectedAsignacion.equipo_id)?.descripcion}
                  </span>
                </div>
              )}

              <FormField
                control={asignacionForm.control}
                name="cliente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientes.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id.toString()}>
                            {cliente.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={asignacionForm.control}
                name="proyecto_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proyecto *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar proyecto..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {proyectos.map((proyecto) => (
                          <SelectItem key={proyecto.id} value={proyecto.id.toString()}>
                            {proyecto.nombre_corto}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={asignacionForm.control}
                name="responsable_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsable</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del responsable" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={asignacionForm.control}
                name="fecha_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Inicio *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={asignacionForm.control}
                name="tipo_uso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Uso *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="propio">Propio</SelectItem>
                        <SelectItem value="alquiler">Alquiler</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {tipoUso === 'alquiler' && (
                <>
                  <FormField
                    control={asignacionForm.control}
                    name="tipo_cobro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Cobro</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="hora">Por Hora</SelectItem>
                            <SelectItem value="dia">Por Día</SelectItem>
                            <SelectItem value="semana">Por Semana</SelectItem>
                            <SelectItem value="mes">Por Mes</SelectItem>
                            <SelectItem value="costo_fijo">Costo Fijo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={asignacionForm.control}
                    name="tarifa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarifa</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Ej: 100.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={asignacionForm.control}
                name="incluye_operador"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Incluye Operador</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {incluyeOperador && (
                <FormField
                  control={asignacionForm.control}
                  name="costo_operador"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Operador</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ej: 50.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={asignacionForm.control}
                name="incluye_combustible"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Incluye Combustible</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {incluyeCombustible && (
                <FormField
                  control={asignacionForm.control}
                  name="costo_combustible"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Combustible</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ej: 25.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={asignacionForm.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Comentarios adicionales" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                {selectedAsignacion && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteClick}
                    disabled={isSubmitting}
                  >
                    Eliminar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : selectedAsignacion ? (
                    'Actualizar'
                  ) : (
                    'Crear Asignación'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Formulario de Registro de Uso */}
      <Dialog open={registroUsoOpen} onOpenChange={setRegistroUsoOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Uso del Equipo</DialogTitle>
            <DialogDescription>
              {selectedAsignacion?.equipo_descripcion} -{' '}
              {selectedAsignacion?.cliente_abreviatura || selectedAsignacion?.cliente_nombre}
            </DialogDescription>
          </DialogHeader>

          <Form {...registroUsoForm}>
            <form
              onSubmit={registroUsoForm.handleSubmit(handleRegistroUsoSubmit)}
              className="space-y-4"
            >
              <FormField
                control={registroUsoForm.control}
                name="fecha_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedAsignacion?.tipo_cobro !== 'hora' && (
                <FormField
                  control={registroUsoForm.control}
                  name="fecha_fin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Fin</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={registroUsoForm.control}
                name="cantidad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Cantidad ({selectedAsignacion?.tipo_cobro || 'horas'}) *
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registroUsoForm.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Comentarios..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tabla de registros anteriores */}
              {registrosUso.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Registros Anteriores</h4>
                  <div className="rounded-md border max-h-40 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrosUso.map((registro) => (
                          <TableRow key={registro.id}>
                            <TableCell className="text-sm">
                              {new Date(registro.fecha_inicio).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm">{registro.cantidad}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRegistroUsoOpen(false)}
                  disabled={isSubmitting}
                >
                  Cerrar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Registrar'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación de Eliminación */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar esta asignación? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
