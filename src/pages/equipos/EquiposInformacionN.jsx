/**
 * Página de Información de Equipos - Migrada a Shadcn/ui
 *
 * CRUD completo de equipos con:
 * - Dos tablas separadas (Pinellas y COCP)
 * - Modal de detalles
 * - Formulario crear/editar con validación Zod
 * - Modal de confirmación para eliminar
 * - Loading states
 * - Sin FontAwesome, sin CSS custom
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../../services/api'
import logo from '../../assets/logo.png'
import cocpLogo from '../../assets/LogoCOCPfondoblanco.png'

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
import { Plus, Pencil, Loader2 } from 'lucide-react'

// Schema de validación con Zod
const equipoSchema = z.object({
  codigo: z.string().optional().or(z.literal('')),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  marca: z.string().min(1, 'Marca es obligatoria'),
  modelo: z.string().min(1, 'Modelo es obligatorio'),
  ano: z.coerce.number()
    .min(1900, 'Año debe ser mayor a 1900')
    .max(2030, 'Año debe ser menor a 2030'),
  motor: z.string().optional().or(z.literal('')),
  chasis: z.string().optional().or(z.literal('')),
  costo: z.coerce.number().optional().or(z.literal('')),
  valor_actual: z.coerce.number().optional().or(z.literal('')),
  rata_mes: z.coerce.number().optional().or(z.literal('')),
  observaciones: z.string().optional().or(z.literal('')),
  owner: z.enum(['Pinellas', 'COCP']),
})

export default function EquiposInformacionN() {
  const [equiposPinellas, setEquiposPinellas] = useState([])
  const [equiposCOCP, setEquiposCOCP] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Estados para modales
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedEquipo, setSelectedEquipo] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingEquipo, setEditingEquipo] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [equipoToDelete, setEquipoToDelete] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form setup
  const form = useForm({
    resolver: zodResolver(equipoSchema),
    defaultValues: {
      codigo: '',
      descripcion: '',
      marca: '',
      modelo: '',
      ano: new Date().getFullYear(),
      motor: '',
      chasis: '',
      costo: '',
      valor_actual: '',
      rata_mes: '',
      observaciones: '',
      owner: 'Pinellas',
    },
  })

  // Cargar equipos desde API
  const loadEquipos = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await api.get('/equipos')

      if (response.data.success) {
        const equipos = response.data.data

        // Separar equipos por propietario
        const pinellas = equipos.filter((equipo) => equipo.owner === 'Pinellas')
        const cocp = equipos.filter((equipo) => equipo.owner === 'COCP')

        setEquiposPinellas(pinellas)
        setEquiposCOCP(cocp)
      } else {
        setError('Error al cargar equipos')
      }
    } catch (error) {
      console.error('Error loading equipos:', error)
      setError('Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEquipos()
  }, [])

  // Formato de moneda
  const formatMoney = (amount) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Handlers
  const handleAddEquipo = () => {
    setEditingEquipo(null)
    form.reset({
      codigo: '',
      descripcion: '',
      marca: '',
      modelo: '',
      ano: new Date().getFullYear(),
      motor: '',
      chasis: '',
      costo: '',
      valor_actual: '',
      rata_mes: '',
      observaciones: '',
      owner: 'Pinellas',
    })
    setFormOpen(true)
  }

  const handleEditEquipo = (equipo, e) => {
    e.stopPropagation()
    setEditingEquipo(equipo)
    form.reset({
      codigo: equipo.codigo || '',
      descripcion: equipo.descripcion || '',
      marca: equipo.marca || '',
      modelo: equipo.modelo || '',
      ano: equipo.ano || new Date().getFullYear(),
      motor: equipo.motor || '',
      chasis: equipo.chasis || '',
      costo: equipo.costo || '',
      valor_actual: equipo.valor_actual || '',
      rata_mes: equipo.rata_mes || '',
      observaciones: equipo.observaciones || '',
      owner: equipo.owner || 'Pinellas',
    })
    setFormOpen(true)
  }

  const handleRowClick = (equipo) => {
    setSelectedEquipo(equipo)
    setDetailsOpen(true)
  }

  const handleSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      const equipoData = {
        codigo: data.codigo || null,
        descripcion: data.descripcion,
        marca: data.marca,
        modelo: data.modelo,
        ano: parseInt(data.ano),
        motor: data.motor || null,
        chasis: data.chasis || null,
        costo: data.costo && data.costo !== '' ? parseFloat(data.costo) : null,
        valor_actual: data.valor_actual && data.valor_actual !== '' ? parseFloat(data.valor_actual) : null,
        rata_mes: data.rata_mes && data.rata_mes !== '' ? parseFloat(data.rata_mes) : null,
        observaciones: data.observaciones || null,
        owner: data.owner,
      }

      if (editingEquipo) {
        await api.put(`/equipos/${editingEquipo.id}`, equipoData)
      } else {
        await api.post('/equipos', equipoData)
      }

      await loadEquipos()
      setFormOpen(false)
      setEditingEquipo(null)
      form.reset()
    } catch (error) {
      console.error('Error al guardar equipo:', error)
      setError(error.response?.data?.message || 'Error al guardar el equipo')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = () => {
    setEquipoToDelete(editingEquipo)
    setDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!equipoToDelete) return

    setIsSubmitting(true)
    try {
      await api.delete(`/equipos/${equipoToDelete.id}`)
      await loadEquipos()
      setDeleteOpen(false)
      setFormOpen(false)
      setEquipoToDelete(null)
      setEditingEquipo(null)
      form.reset()
    } catch (error) {
      console.error('Error deleting equipo:', error)
      setError('Error al eliminar el equipo')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Renderizar tabla de equipos
  const renderTable = (equipos, emptyMessage) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Año</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            equipos.map((equipo) => (
              <TableRow
                key={equipo.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(equipo)}
              >
                <TableCell className="font-medium">{equipo.codigo || 'N/A'}</TableCell>
                <TableCell>{equipo.descripcion}</TableCell>
                <TableCell>{equipo.marca}</TableCell>
                <TableCell>{equipo.modelo}</TableCell>
                <TableCell>{equipo.ano}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleEditEquipo(equipo, e)}
                    title="Editar equipo"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Cargando equipos...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !formOpen) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={loadEquipos}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end">
        <Button onClick={handleAddEquipo}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Equipo
        </Button>
      </div>

      {/* Tabla de Equipos de Pinellas */}
      <div className="space-y-4">
        <div className="flex justify-center">
          <img src={logo} alt="Pinellas Logo" className="h-8 object-contain" />
        </div>
        {renderTable(equiposPinellas, 'No hay equipos de Pinellas disponibles')}
      </div>

      {/* Tabla de Equipos de COCP */}
      <div className="space-y-4 mt-8">
        <div className="flex justify-center">
          <img src={cocpLogo} alt="COCP Logo" className="h-8 object-contain" />
        </div>
        {renderTable(equiposCOCP, 'No hay equipos de COCP disponibles')}
      </div>

      {/* Modal de Detalles */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalles del Equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Código:</span>
              <span className="col-span-2">{selectedEquipo?.codigo || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Descripción:</span>
              <span className="col-span-2">{selectedEquipo?.descripcion}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Marca:</span>
              <span className="col-span-2">{selectedEquipo?.marca}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Modelo:</span>
              <span className="col-span-2">{selectedEquipo?.modelo}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Año:</span>
              <span className="col-span-2">{selectedEquipo?.ano}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium"># Motor:</span>
              <span className="col-span-2">{selectedEquipo?.motor || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium"># Chasis:</span>
              <span className="col-span-2">{selectedEquipo?.chasis || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Costo:</span>
              <span className="col-span-2">
                {selectedEquipo ? formatMoney(selectedEquipo.costo) : 'N/A'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Valor Actual:</span>
              <span className="col-span-2">
                {selectedEquipo ? formatMoney(selectedEquipo.valor_actual) : 'N/A'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Rata/Mes:</span>
              <span className="col-span-2">
                {selectedEquipo ? formatMoney(selectedEquipo.rata_mes) : 'N/A'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-medium">Propietario:</span>
              <span className="col-span-2">{selectedEquipo?.owner}</span>
            </div>
            {selectedEquipo?.observaciones && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-medium">Observaciones:</span>
                <span className="col-span-2">{selectedEquipo.observaciones}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Formulario Crear/Editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEquipo ? 'Editar Equipo' : 'Agregar Nuevo Equipo'}
            </DialogTitle>
            <DialogDescription>
              {editingEquipo ? 'Modifica la información del equipo' : 'Completa los datos del nuevo equipo'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="owner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Propietario *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar propietario" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Pinellas">Pinellas</SelectItem>
                        <SelectItem value="COCP">COCP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 01-19" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Retroexcavadora, Pala 21 Ton"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: John Deere" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 310K" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="ano"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1900" max="2030" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="motor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel># Motor</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de motor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chasis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel># Chasis</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de chasis" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="costo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valor_actual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Actual</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rata_mes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rata/Mes</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observaciones adicionales..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                {editingEquipo && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteClick}
                    disabled={isSubmitting}
                  >
                    Eliminar Equipo
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
                  ) : (
                    `${editingEquipo ? 'Actualizar' : 'Guardar'} Equipo`
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
              ¿Está seguro de eliminar el equipo "{equipoToDelete?.descripcion}"?
              Esta acción no se puede deshacer.
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
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
            >
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
