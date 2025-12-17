/**
 * ProjectTodos Component
 * Manage todos/tasks for a project
 */

import { useState, useEffect } from "react"
import {
  Plus, Circle, CheckCircle2, Calendar, User,
  Pencil, Trash2, Settings, MessageSquare, Send
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import api from "../../services/api"

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const formatShortDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short'
  })
}

const getPrioridadConfig = (prioridad) => {
  const config = {
    'alta': { label: 'Alta', color: '#ef4444', bgColor: 'bg-red-500' },
    'media': { label: 'Media', color: '#eab308', bgColor: 'bg-yellow-500' },
    'baja': { label: 'Baja', color: '#6b7280', bgColor: 'bg-gray-400' }
  }
  return config[prioridad] || config['media']
}

export default function ProjectTodos({ projectId }) {
  const [todos, setTodos] = useState([])
  const [categories, setCategories] = useState([])
  const [members, setMembers] = useState([])
  const [stats, setStats] = useState({ total: 0, pendientes: 0, completados: 0, alta_prioridad: 0 })
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterEstado, setFilterEstado] = useState('all')
  const [filterPrioridad, setFilterPrioridad] = useState('all')

  // Modals
  const [showForm, setShowForm] = useState(false)
  const [editingTodo, setEditingTodo] = useState(null)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    category_id: '',
    asignado_a: '',
    fecha_limite: '',
    prioridad: 'media'
  })
  const [saving, setSaving] = useState(false)

  // Category form
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#6b7280')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [useCustomColor, setUseCustomColor] = useState(false)
  const [addingPreset, setAddingPreset] = useState(null) // Track which preset is being added

  // Colores preestablecidos para categorías
  const presetColors = [
    { color: '#ef4444', name: 'Rojo' },
    { color: '#f97316', name: 'Naranja' },
    { color: '#eab308', name: 'Amarillo' },
    { color: '#22c55e', name: 'Verde' },
    { color: '#06b6d4', name: 'Cyan' },
    { color: '#3b82f6', name: 'Azul' },
    { color: '#8b5cf6', name: 'Violeta' },
    { color: '#ec4899', name: 'Rosa' },
    { color: '#6b7280', name: 'Gris' },
    { color: '#78716c', name: 'Marrón' },
  ]

  // Categorías preestablecidas (templates)
  const presetCategories = [
    { nombre: 'Administrativo', color: '#6b7280' },
    { nombre: 'Diseño', color: '#8b5cf6' },
    { nombre: 'Contabilidad', color: '#22c55e' },
    { nombre: 'Cotización', color: '#f97316' },
    { nombre: 'Campo', color: '#eab308' },
  ]

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [todosRes, categoriesRes, membersRes] = await Promise.all([
        api.get(`/project-todos/projects/${projectId}`),
        api.get(`/project-todos/projects/${projectId}/categories`),
        api.get(`/project-members/project/${projectId}`)
      ])

      if (todosRes.data.success) {
        setTodos(todosRes.data.todos)
        setStats(todosRes.data.stats)
      }
      if (categoriesRes.data.success) {
        setCategories(categoriesRes.data.categories)
      }
      if (membersRes.data.success) {
        setMembers(membersRes.data.members)
      }
    } catch (error) {
      console.error('Error loading todos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (todo) => {
    try {
      await api.patch(`/project-todos/${todo.id}/toggle`)
      loadData()
    } catch (error) {
      console.error('Error toggling todo:', error)
    }
  }

  const handleOpenForm = (todo = null) => {
    if (todo) {
      setEditingTodo(todo)
      setFormData({
        titulo: todo.titulo,
        descripcion: todo.descripcion || '',
        category_id: todo.category_id?.toString() || 'none',
        asignado_a: todo.asignado_a?.toString() || 'none',
        fecha_limite: todo.fecha_limite ? todo.fecha_limite.split('T')[0] : '',
        prioridad: todo.prioridad
      })
    } else {
      setEditingTodo(null)
      setFormData({
        titulo: '',
        descripcion: '',
        category_id: 'none',
        asignado_a: 'none',
        fecha_limite: '',
        prioridad: 'media'
      })
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.titulo.trim()) return

    try {
      setSaving(true)

      // Build payload with proper types
      const payload = {
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion?.trim() || null,
        prioridad: formData.prioridad
      }

      // Only include category_id if it has a valid value (not 'none')
      if (formData.category_id && formData.category_id !== 'none') {
        payload.category_id = parseInt(formData.category_id, 10)
      }

      // Only include asignado_a if it has a valid value (not 'none')
      if (formData.asignado_a && formData.asignado_a !== 'none') {
        payload.asignado_a = parseInt(formData.asignado_a, 10)
      }

      // Only include fecha_limite if it has a value
      if (formData.fecha_limite) {
        payload.fecha_limite = formData.fecha_limite
      }

      if (editingTodo) {
        await api.put(`/project-todos/${editingTodo.id}`, payload)
      } else {
        await api.post(`/project-todos/projects/${projectId}`, payload)
      }

      setShowForm(false)
      loadData()
    } catch (error) {
      console.error('Error saving todo:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (todo) => {
    if (!confirm('¿Eliminar esta tarea?')) return

    try {
      await api.delete(`/project-todos/${todo.id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting todo:', error)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return

    // Verificar si ya existe localmente
    const exists = categories.some(cat => cat.nombre.toLowerCase() === newCategoryName.trim().toLowerCase())
    if (exists) {
      alert(`La categoría "${newCategoryName}" ya existe`)
      return
    }

    try {
      const response = await api.post(`/project-todos/projects/${projectId}/categories`, {
        nombre: newCategoryName.trim(),
        color: newCategoryColor
      })
      if (response.data.success) {
        setNewCategoryName('')
        setNewCategoryColor('#6b7280')
        setShowAddCategory(false)
        setUseCustomColor(false)
        loadData()
      } else {
        alert(response.data.message || 'Error al crear categoría')
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Error al crear categoría'
      alert(message)
      console.error('Error adding category:', error)
    }
  }

  const handleAddPresetCategory = async (preset) => {
    // Evitar clicks múltiples
    if (addingPreset) return

    setAddingPreset(preset.nombre)
    try {
      const response = await api.post(`/project-todos/projects/${projectId}/categories`, {
        nombre: preset.nombre,
        color: preset.color
      })
      if (response.data.success) {
        await loadData()
      }
    } catch (error) {
      // Siempre recargar para sincronizar
      await loadData()
    } finally {
      setAddingPreset(null)
    }
  }

  const resetCategoryForm = () => {
    setNewCategoryName('')
    setNewCategoryColor('#6b7280')
    setShowAddCategory(false)
    setUseCustomColor(false)
  }

  const handleDeleteCategory = async (categoryId) => {
    try {
      await api.delete(`/project-todos/categories/${categoryId}`)
      loadData()
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const handleOpenDetail = async (todo) => {
    setSelectedTodo(todo)
    setShowDetail(true)
    setComments([])
    setNewComment('')
    loadComments(todo.id)
  }

  const loadComments = async (todoId) => {
    try {
      setLoadingComments(true)
      const response = await api.get(`/project-todos/${todoId}/comments`)
      if (response.data.success) {
        setComments(response.data.comments)
      }
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTodo) return

    try {
      setSendingComment(true)
      const response = await api.post(`/project-todos/${selectedTodo.id}/comments`, {
        contenido: newComment.trim()
      })
      if (response.data.success) {
        setComments([...comments, response.data.comment])
        setNewComment('')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setSendingComment(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/project-todos/comments/${commentId}`)
      setComments(comments.filter(c => c.id !== commentId))
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  // Filter todos
  const filteredTodos = todos.filter(todo => {
    if (filterEstado !== 'all' && todo.estado !== filterEstado) return false
    if (filterPrioridad !== 'all' && todo.prioridad !== filterPrioridad) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando tareas...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-yellow-600">{stats.pendientes}</div>
            <div className="text-sm text-muted-foreground">Pendientes</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-green-600">{stats.completados}</div>
            <div className="text-sm text-muted-foreground">Completados</div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-red-600">{stats.alta_prioridad}</div>
            <div className="text-sm text-muted-foreground">Alta Prioridad</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-[130px]">
              <SelectValue>
                {filterEstado === 'all' ? 'Estado' : filterEstado === 'pendiente' ? 'Pendientes' : 'Completados'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="completado">Completados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPrioridad} onValueChange={setFilterPrioridad}>
            <SelectTrigger className="w-[130px]">
              <SelectValue>
                {filterPrioridad === 'all' ? 'Prioridad' : filterPrioridad === 'alta' ? 'Alta' : filterPrioridad === 'media' ? 'Media' : 'Baja'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>

        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Categorías
          </Button>
          <Button onClick={() => handleOpenForm()}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* Todos Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Tarea</TableHead>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[140px]">Asignado</TableHead>
              <TableHead className="w-[100px]">Vence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTodos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay tareas {filterEstado !== 'all' || filterPrioridad !== 'all' ? 'con estos filtros' : ''}
                </TableCell>
              </TableRow>
            ) : (
              filteredTodos.map(todo => {
                const prioridadConfig = getPrioridadConfig(todo.prioridad)
                const isCompleted = todo.estado === 'completado'
                const isOverdue = todo.fecha_limite && !isCompleted && new Date(todo.fecha_limite) < new Date()

                return (
                  <TableRow
                    key={todo.id}
                    className={`cursor-pointer hover:bg-muted/50 ${isCompleted ? 'opacity-60 bg-muted/30' : ''}`}
                    onClick={() => handleOpenDetail(todo)}
                  >
                    {/* Toggle Button */}
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggle(todo)}
                        className={`
                          transition-all duration-200 hover:scale-110
                          ${isCompleted
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-gray-400 hover:text-green-500'
                          }
                        `}
                        title={isCompleted ? 'Marcar como pendiente' : 'Marcar como completado'}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <Circle className="h-6 w-6" />
                        )}
                      </button>
                    </TableCell>

                    {/* Tarea */}
                    <TableCell>
                      <span className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.titulo}
                      </span>
                    </TableCell>

                    {/* Prioridad - Círculo con ! */}
                    <TableCell className="text-center">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                        style={{ backgroundColor: prioridadConfig.color }}
                        title={`Prioridad ${prioridadConfig.label}`}
                      >
                        <span className="text-white text-xs font-bold">!</span>
                      </div>
                    </TableCell>

                    {/* Asignado */}
                    <TableCell>
                      {todo.asignado_nombre ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{todo.asignado_nombre}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>

                    {/* Fecha Límite */}
                    <TableCell>
                      {todo.fecha_limite ? (
                        <div className={`flex items-center gap-1.5 text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                          <Calendar className={`h-4 w-4 ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`} />
                          {formatShortDate(todo.fecha_limite)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Todo Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTodo ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingTodo ? 'Modifica los detalles de la tarea' : 'Crea una nueva tarea para el proyecto'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="¿Qué necesitas hacer?"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Detalles adicionales..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridad</Label>
                <Select
                  value={formData.prioridad}
                  onValueChange={(v) => setFormData({ ...formData, prioridad: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fecha Límite</Label>
                <Input
                  type="date"
                  value={formData.fecha_limite}
                  onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.nombre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Asignar a</Label>
                <Select
                  value={formData.asignado_a}
                  onValueChange={(v) => setFormData({ ...formData, asignado_a: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.nombre_display || m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.titulo.trim() || saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Manager Modal */}
      <Dialog open={showCategoryManager} onOpenChange={(open) => {
        setShowCategoryManager(open)
        if (!open) resetCategoryForm()
      }}>
        <DialogContent className="sm:max-w-[450px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Administrar Categorías</DialogTitle>
            <DialogDescription className="sr-only">
              Gestiona las categorías de tareas del proyecto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Existing categories list */}
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Categorías del proyecto</Label>
              <div className="mt-2 space-y-2">
                {categories.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed">
                    No hay categorías creadas
                  </div>
                ) : (
                  categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between px-2.5 py-1.5 border rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm">{cat.nombre}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add category section */}
            {!showAddCategory ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAddCategory(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Categoría
              </Button>
            ) : (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Nueva categoría</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={resetCategoryForm}
                  >
                    Cancelar
                  </Button>
                </div>

                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nombre de la categoría"
                  autoFocus
                />

                {/* Color selection */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {presetColors.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        className={`w-8 h-8 rounded-full ring-offset-2 transition-all hover:scale-110 ${
                          newCategoryColor === preset.color && !useCustomColor
                            ? 'ring-2 ring-primary'
                            : 'ring-1 ring-black/10'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => {
                          setNewCategoryColor(preset.color)
                          setUseCustomColor(false)
                        }}
                        title={preset.name}
                      />
                    ))}
                    {/* Custom color button */}
                    <div className="relative">
                      <button
                        type="button"
                        className={`w-8 h-8 rounded-full ring-offset-2 transition-all hover:scale-110 flex items-center justify-center border-2 border-dashed ${
                          useCustomColor ? 'ring-2 ring-primary border-primary' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: useCustomColor ? newCategoryColor : 'white' }}
                        onClick={() => setUseCustomColor(true)}
                        title="Color personalizado"
                      >
                        {!useCustomColor && <Plus className="h-3 w-3 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Custom color picker */}
                  {useCustomColor && (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="color"
                        value={newCategoryColor}
                        onChange={(e) => setNewCategoryColor(e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">{newCategoryColor}</span>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                >
                  Crear Categoría
                </Button>
              </div>
            )}

            {/* Preset categories section */}
            {(() => {
              const existingNames = new Set(categories.map(cat => cat.nombre.toLowerCase().trim()))
              const availablePresets = presetCategories.filter(preset =>
                !existingNames.has(preset.nombre.toLowerCase().trim())
              )

              return (
                <div className="pt-2 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">Categorías sugeridas</Label>
                  <p className="text-xs text-muted-foreground mb-3">Haz clic para agregar rápidamente</p>
                  <div className="flex flex-wrap gap-2">
                    {availablePresets.length > 0 ? (
                      availablePresets.map((preset) => (
                        <button
                          key={preset.nombre}
                          type="button"
                          disabled={addingPreset !== null}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            addingPreset === preset.nombre
                              ? 'opacity-50 cursor-wait'
                              : addingPreset
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleAddPresetCategory(preset)}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: preset.color }}
                          />
                          {addingPreset === preset.nombre ? 'Agregando...' : preset.nombre}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        Todas las categorías sugeridas ya fueron agregadas
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Todo Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">Detalles de la Tarea</DialogTitle>
            <DialogDescription className="sr-only">
              Ver todos los detalles de la tarea seleccionada
            </DialogDescription>
          </DialogHeader>
          {selectedTodo && (() => {
            const prioridadConfig = getPrioridadConfig(selectedTodo.prioridad)
            const isCompleted = selectedTodo.estado === 'completado'
            const isOverdue = selectedTodo.fecha_limite && !isCompleted && new Date(selectedTodo.fecha_limite) < new Date()

            return (
              <div className="space-y-3">
                {/* Título y Estado */}
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => {
                      handleToggle(selectedTodo)
                      setShowDetail(false)
                    }}
                    className={`mt-0.5 transition-all duration-200 hover:scale-110 ${
                      isCompleted
                        ? 'text-green-600 hover:text-green-700'
                        : 'text-gray-400 hover:text-green-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                      {selectedTodo.titulo}
                    </h3>
                    {selectedTodo.descripcion && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {selectedTodo.descripcion}
                      </p>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t text-sm">
                  {/* Prioridad */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Prioridad:</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: prioridadConfig.color }}
                      >
                        <span className="text-white text-[9px] font-bold">!</span>
                      </div>
                      <span>{prioridadConfig.label}</span>
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Estado:</span>
                    <Badge variant={isCompleted ? 'default' : 'secondary'} className={`text-xs ${isCompleted ? 'bg-green-600' : ''}`}>
                      {isCompleted ? 'Completado' : 'Pendiente'}
                    </Badge>
                  </div>

                  {/* Categoría */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Categoría:</span>
                    {selectedTodo.categoria_nombre ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: selectedTodo.categoria_color }}
                        />
                        <span>{selectedTodo.categoria_nombre}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Asignado */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Asignado:</span>
                    {selectedTodo.asignado_nombre ? (
                      <span>
                        {selectedTodo.asignado_nombre}
                        {selectedTodo.asignado_tipo === 'externo' && ' (Ext)'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Fecha Límite */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Vence:</span>
                    {selectedTodo.fecha_limite ? (
                      <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                        {formatShortDate(selectedTodo.fecha_limite)}
                        {isOverdue && ' (Vencido)'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Creado */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Creado:</span>
                    <span>{formatShortDate(selectedTodo.created_at)}</span>
                  </div>
                </div>

                {/* Completado info */}
                {isCompleted && selectedTodo.completado_at && (
                  <div className="text-sm text-green-600 pt-1">
                    Completado {formatShortDate(selectedTodo.completado_at)}
                    {selectedTodo.completado_por_nombre && ` por ${selectedTodo.completado_por_nombre}`}
                  </div>
                )}

                {/* Comments Section */}
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">Comentarios</span>
                    {comments.length > 0 && (
                      <span className="text-xs text-muted-foreground">({comments.length})</span>
                    )}
                  </div>

                  {/* Comments list */}
                  <div className="space-y-2 max-h-[150px] overflow-y-auto mb-2">
                    {loadingComments ? (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        Cargando...
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        No hay comentarios
                      </div>
                    ) : (
                      comments.map(comment => (
                        <div key={comment.id} className="bg-muted/30 rounded px-2.5 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium">{comment.usuario_nombre}</span>
                                <span className="text-muted-foreground">
                                  {formatShortDate(comment.created_at)}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{comment.contenido}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add comment input */}
                  <div className="flex gap-2">
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Escribe un comentario..."
                      className="flex-1 h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAddComment()
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || sendingComment}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              className="sm:mr-auto"
              onClick={() => {
                setShowDetail(false)
                handleDelete(selectedTodo)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              setShowDetail(false)
              handleOpenForm(selectedTodo)
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
