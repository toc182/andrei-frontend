/**
 * ProjectMembers Component
 * Gestiona los miembros de un proyecto (usuarios del sistema + contactos externos)
 */

import { useState, useEffect } from "react"
import { Plus, UserPlus, Trash2, Users, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import api from "../../services/api"

const ROLES_PROYECTO = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'ingeniero', label: 'Ingeniero' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'miembro', label: 'Miembro' },
]

export default function ProjectMembers({ projectId }) {
  const [members, setMembers] = useState([])
  const [users, setUsers] = useState([])
  const [externalContacts, setExternalContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showAddExternalModal, setShowAddExternalModal] = useState(false)
  const [showCreateExternalModal, setShowCreateExternalModal] = useState(false)

  // Form states
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedExternalId, setSelectedExternalId] = useState('')
  const [selectedRol, setSelectedRol] = useState('miembro')
  const [newExternal, setNewExternal] = useState({ nombre: '', cargo: '', telefono: '' })
  const [saving, setSaving] = useState(false)

  // Edit role state
  const [showEditRoleModal, setShowEditRoleModal] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [editRol, setEditRol] = useState('')

  // Load members
  const loadMembers = async () => {
    try {
      const response = await api.get(`/project-members/project/${projectId}`)
      if (response.data.success) {
        setMembers(response.data.members)
      }
    } catch (err) {
      console.error('Error loading members:', err)
      setError('Error al cargar miembros')
    }
  }

  // Load users and external contacts for selectors
  const loadOptions = async () => {
    try {
      const [usersRes, externalsRes] = await Promise.all([
        api.get('/project-members/users'),
        api.get('/project-members/external-contacts')
      ])

      if (usersRes.data.success) {
        setUsers(usersRes.data.users)
      }
      if (externalsRes.data.success) {
        setExternalContacts(externalsRes.data.contacts)
      }
    } catch (err) {
      console.error('Error loading options:', err)
    }
  }

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([loadMembers(), loadOptions()])
      setLoading(false)
    }
    loadAll()
  }, [projectId])

  // Add user member
  const handleAddUser = async () => {
    if (!selectedUserId) return

    setSaving(true)
    try {
      const response = await api.post('/project-members', {
        project_id: projectId,
        user_id: parseInt(selectedUserId),
        rol_proyecto: selectedRol
      })

      if (response.data.success) {
        await loadMembers()
        setShowAddUserModal(false)
        setSelectedUserId('')
        setSelectedRol('miembro')
      }
    } catch (err) {
      console.error('Error adding user:', err)
      setError(err.response?.data?.message || 'Error al agregar usuario')
    } finally {
      setSaving(false)
    }
  }

  // Add external member
  const handleAddExternal = async () => {
    if (!selectedExternalId) return

    setSaving(true)
    try {
      const response = await api.post('/project-members/external', {
        project_id: projectId,
        external_contact_id: parseInt(selectedExternalId),
        rol_proyecto: selectedRol
      })

      if (response.data.success) {
        await loadMembers()
        setShowAddExternalModal(false)
        setSelectedExternalId('')
        setSelectedRol('miembro')
      }
    } catch (err) {
      console.error('Error adding external:', err)
      setError(err.response?.data?.message || 'Error al agregar contacto externo')
    } finally {
      setSaving(false)
    }
  }

  // Create new external contact and add as member
  const handleCreateExternal = async () => {
    if (!newExternal.nombre.trim()) return

    setSaving(true)
    try {
      // First create the external contact
      const createRes = await api.post('/external-contacts', newExternal)

      if (createRes.data.success) {
        // Then add as member
        const addRes = await api.post('/project-members/external', {
          project_id: projectId,
          external_contact_id: createRes.data.contact.id,
          rol_proyecto: selectedRol
        })

        if (addRes.data.success) {
          await Promise.all([loadMembers(), loadOptions()])
          setShowCreateExternalModal(false)
          setNewExternal({ nombre: '', cargo: '', telefono: '' })
          setSelectedRol('miembro')
        }
      }
    } catch (err) {
      console.error('Error creating external:', err)
      setError(err.response?.data?.message || 'Error al crear contacto externo')
    } finally {
      setSaving(false)
    }
  }

  // Remove member
  const handleRemoveMember = async (memberId) => {
    if (!confirm('¿Estás seguro de remover este miembro del proyecto?')) return

    try {
      await api.delete(`/project-members/${memberId}`)
      await loadMembers()
    } catch (err) {
      console.error('Error removing member:', err)
      setError('Error al remover miembro')
    }
  }

  // Open edit role modal
  const handleRowClick = (member) => {
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
      setError(err.response?.data?.message || 'Error al actualizar rol')
    } finally {
      setSaving(false)
    }
  }

  // Get users not already members
  const availableUsers = users.filter(
    user => !members.some(m => m.tipo_miembro === 'usuario' && m.user_id === user.id)
  )

  // Get external contacts not already members
  const availableExternals = externalContacts.filter(
    ec => !members.some(m => m.tipo_miembro === 'externo' && m.external_contact_id === ec.id)
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 shrink-0" />
            <span className="truncate">Miembros del Proyecto</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {members.length} miembro{members.length !== 1 ? 's' : ''} asignado{members.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap shrink-0">
          <Button onClick={() => setShowAddUserModal(true)} size="sm">
            <UserPlus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Agregar Usuario</span>
          </Button>
          <Button onClick={() => setShowAddExternalModal(true)} variant="outline" size="sm">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Agregar Externo</span>
          </Button>
          <Button onClick={() => setShowCreateExternalModal(true)} variant="secondary" size="sm">
            <UserCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Crear Externo</span>
          </Button>
        </div>
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
                    No hay miembros asignados a este proyecto
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
                    <TableCell className="capitalize">
                      {member.rol_proyecto}
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
              No hay miembros asignados a este proyecto
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
                      <Badge variant="outline" className="text-xs capitalize">
                        {member.rol_proyecto}
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

      {/* Add User Modal */}
      <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Agregar Usuario del Sistema</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                        {user.nombre} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => setShowAddUserModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddUser} disabled={!selectedUserId || saving}>
              {saving ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add External Modal */}
      <Dialog open={showAddExternalModal} onOpenChange={setShowAddExternalModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Agregar Contacto Externo Existente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                    availableExternals.map(contact => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.nombre} {contact.cargo ? `(${contact.cargo})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => setShowAddExternalModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddExternal} disabled={!selectedExternalId || saving}>
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
            <DialogTitle>Editar Rol de Miembro</DialogTitle>
          </DialogHeader>

          {editingMember && (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Miembro</Label>
                <div className="font-medium">{editingMember.nombre_display}</div>
                <Badge variant={editingMember.tipo_miembro === 'usuario' ? 'default' : 'secondary'} className="text-xs">
                  {editingMember.tipo_miembro === 'usuario' ? 'Usuario' : 'Externo'}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Rol en el Proyecto</Label>
                <Select value={editRol} onValueChange={setEditRol}>
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
