/**
 * ProjectMembers Component
 * Gestiona el personal de un proyecto (usuarios del sistema + contactos externos)
 */

import { useState, useEffect } from "react"
import { Plus, Trash2, UserCircle, AlertCircle, Settings, ArrowUp, ArrowDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import api from "../../services/api"

interface RolProyecto {
  value: string
  label: string
}

interface User {
  id: number
  nombre: string
  email?: string
  tipo_usuario?: string | null
}

interface ProjectMember {
  id: number
  tipo_miembro: 'usuario' | 'externo'
  user_id?: number
  external_contact_id?: number
  rol_proyecto: string
  nombre_display: string
  usuario_email?: string
  externo_telefono?: string
  externo_email?: string
}

interface NewExternalForm {
  nombre: string
  cargo: string
  telefono: string
}

interface Approver {
  id?: number
  user_id: number
  orden: number
  nombre: string
  email?: string
}

interface ProjectMembersProps {
  projectId: number
}

const ROLES_PROYECTO: RolProyecto[] = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'ingeniero', label: 'Ingeniero' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'colaborador', label: 'Colaborador' },
]

export default function ProjectMembers({ projectId }: ProjectMembersProps) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCreateExternalModal, setShowCreateExternalModal] = useState(false)

  // Form states
  const [memberType, setMemberType] = useState<'usuario' | 'externo'>('usuario')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedExternalId, setSelectedExternalId] = useState('')
  const [selectedRol, setSelectedRol] = useState('colaborador')
  const [newExternal, setNewExternal] = useState<NewExternalForm>({ nombre: '', cargo: '', telefono: '' })
  const [saving, setSaving] = useState(false)

  // Edit role state
  const [showEditRoleModal, setShowEditRoleModal] = useState(false)
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null)
  const [editRol, setEditRol] = useState('')

  // Approvers state
  const [approvers, setApprovers] = useState<Approver[]>([])
  const [showApproversModal, setShowApproversModal] = useState(false)
  const [editApprovers, setEditApprovers] = useState<Approver[]>([])
  const [selectedApproverUserId, setSelectedApproverUserId] = useState('')
  const [savingApprovers, setSavingApprovers] = useState(false)

  // Load members
  const loadMembers = async () => {
    try {
      const response = await api.get(`/project-members/project/${projectId}`)
      if (response.data.success) {
        setMembers(response.data.members)
      }
    } catch (err) {
      console.error('Error loading members:', err)
      setError('Error al cargar personal')
    }
  }

  // Load users for selectors
  const loadOptions = async () => {
    try {
      const usersRes = await api.get('/project-members/users')
      if (usersRes.data.success) {
        setUsers(usersRes.data.users)
      }
    } catch (err) {
      console.error('Error loading options:', err)
    }
  }

  // Load approvers
  const loadApprovers = async () => {
    try {
      const response = await api.get(`/approval-settings/project/${projectId}`)
      if (response.data.success) {
        setApprovers(response.data.approvers)
      }
    } catch (err) {
      console.error('Error loading approvers:', err)
    }
  }

  // Save approvers
  const handleSaveApprovers = async () => {
    setSavingApprovers(true)
    try {
      const payload = editApprovers.map((a, index) => ({
        user_id: a.user_id,
        orden: index + 1
      }))
      const response = await api.put(`/approval-settings/project/${projectId}`, { approvers: payload })
      if (response.data.success) {
        setApprovers(response.data.approvers)
        setShowApproversModal(false)
      }
    } catch (err) {
      console.error('Error saving approvers:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Error al guardar aprobadores')
    } finally {
      setSavingApprovers(false)
    }
  }

  // Open approvers modal
  const openApproversModal = () => {
    setEditApprovers([...approvers])
    setSelectedApproverUserId('')
    setShowApproversModal(true)
  }

  // Add approver to edit list
  const addApproverToList = () => {
    if (!selectedApproverUserId) return
    const userId = parseInt(selectedApproverUserId)
    const user = users.find(u => u.id === userId)
    if (!user) return
    if (editApprovers.some(a => a.user_id === userId)) return

    setEditApprovers([...editApprovers, {
      user_id: userId,
      orden: editApprovers.length + 1,
      nombre: user.nombre,
      email: user.email
    }])
    setSelectedApproverUserId('')
  }

  // Remove approver from edit list
  const removeApproverFromList = (userId: number) => {
    setEditApprovers(editApprovers.filter(a => a.user_id !== userId))
  }

  // Move approver up/down
  const moveApprover = (index: number, direction: 'up' | 'down') => {
    const newList = [...editApprovers]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newList.length) return
    const temp = newList[index]
    newList[index] = newList[targetIndex]
    newList[targetIndex] = temp
    setEditApprovers(newList)
  }

  // Users available as approvers (not already in edit list)
  const availableApproverUsers = users.filter(
    u => u.tipo_usuario === 'interno'
      && members.some(m => m.tipo_miembro === 'usuario' && m.user_id === u.id)
      && !editApprovers.some(a => a.user_id === u.id)
  )

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([loadMembers(), loadOptions(), loadApprovers()])
      setLoading(false)
    }
    loadAll()
  }, [projectId])

  // Reset add modal
  const resetAddModal = () => {
    setMemberType('usuario')
    setSelectedUserId('')
    setSelectedExternalId('')
    setSelectedRol('colaborador')
  }

  // Add member (user — both internal and external are in users table)
  const handleAddMember = async () => {
    const userId = memberType === 'usuario' ? selectedUserId : selectedExternalId
    if (!userId) return

    setSaving(true)
    try {
      const response = await api.post('/project-members', {
        project_id: projectId,
        user_id: parseInt(userId),
        rol_proyecto: selectedRol
      })
      if (response.data.success) {
        await loadMembers()
        setShowAddModal(false)
        resetAddModal()
      }
    } catch (err) {
      console.error('Error adding member:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Error al agregar')
    } finally {
      setSaving(false)
    }
  }

  // Create new external contact and add as member
  const handleCreateExternal = async () => {
    if (!newExternal.nombre.trim()) return

    setSaving(true)
    try {
      const createRes = await api.post('/external-contacts', newExternal)

      if (createRes.data.success) {
        const addRes = await api.post('/project-members/external', {
          project_id: projectId,
          external_contact_id: createRes.data.contact.id,
          rol_proyecto: selectedRol
        })

        if (addRes.data.success) {
          await Promise.all([loadMembers(), loadOptions()])
          setShowCreateExternalModal(false)
          setNewExternal({ nombre: '', cargo: '', telefono: '' })
          setSelectedRol('colaborador')
        }
      }
    } catch (err) {
      console.error('Error creating external:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Error al crear contacto externo')
    } finally {
      setSaving(false)
    }
  }

  // Remove member
  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('¿Estás seguro de remover esta persona del proyecto?')) return

    try {
      await api.delete(`/project-members/${memberId}`)
      await loadMembers()
    } catch (err) {
      console.error('Error removing member:', err)
      setError('Error al remover')
    }
  }

  // Open edit role modal
  const handleRowClick = (member: ProjectMember) => {
    setEditingMember(member)
    setEditRol(member.rol_proyecto)
    setShowEditRoleModal(true)
  }

  // Update role
  const handleUpdateRole = async () => {
    if (!editingMember || !editRol) return

    setSaving(true)
    try {
      const response = await api.put(`/project-members/${editingMember.id}`, {
        rol_proyecto: editRol
      })

      if (response.data.success) {
        await loadMembers()
        setShowEditRoleModal(false)
        setEditingMember(null)
      }
    } catch (err) {
      console.error('Error updating role:', err)
      const apiError = err as { response?: { data?: { message?: string } } }
      setError(apiError.response?.data?.message || 'Error al actualizar rol')
    } finally {
      setSaving(false)
    }
  }

  // Get internal users not already members
  const availableUsers = users.filter(
    user => (user.tipo_usuario === 'interno' || !user.tipo_usuario)
      && !members.some(m => m.user_id === user.id)
  )

  // Get external users not already members
  const availableExternals = users.filter(
    user => user.tipo_usuario === 'externo'
      && !members.some(m => m.user_id === user.id)
  )

  // Format role display (handle old 'miembro' values)
  const formatRol = (rol: string) => {
    if (rol === 'miembro') return 'Colaborador'
    return rol.charAt(0).toUpperCase() + rol.slice(1)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button onClick={() => { resetAddModal(); setShowAddModal(true) }} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Agregar
        </Button>
        <Button onClick={() => setShowCreateExternalModal(true)} variant="outline" size="sm">
          <UserCircle className="h-4 w-4 mr-2" />
          Crear
        </Button>
      </div>

      {/* Members Table - Desktop */}
      <Card className="hidden md:block overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay personal asignado a este proyecto
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow
                    key={member.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(member)}
                  >
                    <TableCell className="font-medium">
                      {member.nombre_display}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.tipo_miembro === 'usuario' ? 'default' : 'secondary'}>
                        {member.tipo_miembro === 'usuario' ? 'Usuario' : 'Externo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatRol(member.rol_proyecto)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {member.tipo_miembro === 'usuario'
                        ? member.usuario_email
                        : member.externo_telefono || member.externo_email || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveMember(member.id)
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Members Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {members.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay personal asignado a este proyecto
            </CardContent>
          </Card>
        ) : (
          members.map((member) => (
            <Card
              key={member.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleRowClick(member)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="font-medium">{member.nombre_display}</div>
                    <div className="flex gap-2">
                      <Badge variant={member.tipo_miembro === 'usuario' ? 'default' : 'secondary'} className="text-xs">
                        {member.tipo_miembro === 'usuario' ? 'Usuario' : 'Externo'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {formatRol(member.rol_proyecto)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {member.tipo_miembro === 'usuario'
                        ? member.usuario_email
                        : member.externo_telefono || member.externo_email || '-'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveMember(member.id)
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Approvers Section */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Aprobadores de Solicitudes de Pago</h3>
          <Button variant="outline" size="sm" onClick={openApproversModal}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar
          </Button>
        </div>
        {approvers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay aprobadores configurados</p>
        ) : (
          <div className="space-y-1">
            {approvers.map((approver, index) => (
              <div key={approver.user_id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                <span className="font-medium text-muted-foreground w-6">{index + 1}.</span>
                <span>{approver.nombre}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approvers Config Modal */}
      <Dialog open={showApproversModal} onOpenChange={setShowApproversModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Configurar Aprobadores</DialogTitle>
            <DialogDescription>
              Los aprobadores revisan las solicitudes de pago en el orden configurado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Add approver */}
            <div className="flex gap-2">
              <Select value={selectedApproverUserId} onValueChange={setSelectedApproverUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar usuario..." />
                </SelectTrigger>
                <SelectContent>
                  {availableApproverUsers.length === 0 ? (
                    <SelectItem value="-" disabled>No hay usuarios disponibles</SelectItem>
                  ) : (
                    availableApproverUsers.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button onClick={addApproverToList} disabled={!selectedApproverUserId} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Ordered list */}
            {editApprovers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Agregue al menos un aprobador
              </p>
            ) : (
              <div className="space-y-2">
                {editApprovers.map((approver, index) => (
                  <div key={approver.user_id} className="flex items-center gap-2 p-2 border rounded">
                    <span className="font-medium text-muted-foreground w-6 text-sm">{index + 1}.</span>
                    <span className="flex-1 text-sm">{approver.nombre}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => moveApprover(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => moveApprover(index, 'down')}
                        disabled={index === editApprovers.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeApproverFromList(approver.user_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproversModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveApprovers} disabled={savingApprovers}>
              {savingApprovers ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Agregar Personal</DialogTitle>
            <DialogDescription className="sr-only">
              Agregar un usuario o contacto externo al proyecto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Radio buttons for type */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <RadioGroup value={memberType} onValueChange={(v) => {
                setMemberType(v as 'usuario' | 'externo')
                setSelectedUserId('')
                setSelectedExternalId('')
              }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="usuario" id="tipo-usuario" />
                  <Label htmlFor="tipo-usuario" className="font-normal cursor-pointer">Usuario del sistema</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="externo" id="tipo-externo" />
                  <Label htmlFor="tipo-externo" className="font-normal cursor-pointer">Contacto externo</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Dropdown based on type */}
            {memberType === 'usuario' ? (
              <div className="space-y-2">
                <Label>Usuario</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <SelectItem value="-" disabled>No hay usuarios disponibles</SelectItem>
                    ) : (
                      availableUsers.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.nombre}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Contacto Externo</Label>
                <Select value={selectedExternalId} onValueChange={setSelectedExternalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar contacto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableExternals.length === 0 ? (
                      <SelectItem value="-" disabled>No hay contactos disponibles</SelectItem>
                    ) : (
                      availableExternals.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.nombre}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Rol en el Proyecto</Label>
              <Select value={selectedRol} onValueChange={setSelectedRol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_PROYECTO.map(rol => (
                    <SelectItem key={rol.value} value={rol.value}>
                      {rol.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={(memberType === 'usuario' ? !selectedUserId : !selectedExternalId) || saving}
            >
              {saving ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create External Modal */}
      <Dialog open={showCreateExternalModal} onOpenChange={setShowCreateExternalModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Contacto Externo</DialogTitle>
            <DialogDescription className="sr-only">
              Crear un nuevo contacto externo y agregarlo al proyecto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={newExternal.nombre}
                onChange={(e) => setNewExternal({ ...newExternal, nombre: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>

            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={newExternal.cargo}
                onChange={(e) => setNewExternal({ ...newExternal, cargo: e.target.value })}
                placeholder="Ej: Supervisor de Campo"
              />
            </div>

            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={newExternal.telefono}
                onChange={(e) => setNewExternal({ ...newExternal, telefono: e.target.value })}
                placeholder="Ej: 6000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>Rol en el Proyecto</Label>
              <Select value={selectedRol} onValueChange={setSelectedRol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_PROYECTO.map(rol => (
                    <SelectItem key={rol.value} value={rol.value}>
                      {rol.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateExternalModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateExternal} disabled={!newExternal.nombre.trim() || saving}>
              {saving ? 'Creando...' : 'Crear y Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={showEditRoleModal} onOpenChange={setShowEditRoleModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Rol</DialogTitle>
            <DialogDescription className="sr-only">
              Cambiar el rol de un miembro del proyecto
            </DialogDescription>
          </DialogHeader>

          {editingMember && (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Persona</Label>
                <div className="font-medium">{editingMember.nombre_display}</div>
                <Badge variant={editingMember.tipo_miembro === 'usuario' ? 'default' : 'secondary'} className="text-xs">
                  {editingMember.tipo_miembro === 'usuario' ? 'Usuario' : 'Externo'}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Rol en el Proyecto</Label>
                <Select value={editRol === 'miembro' ? 'colaborador' : editRol} onValueChange={setEditRol}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_PROYECTO.map(rol => (
                      <SelectItem key={rol.value} value={rol.value}>
                        {rol.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRoleModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateRole} disabled={saving || editRol === editingMember?.rol_proyecto}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
