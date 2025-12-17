/**
 * ProjectMembers Component
 * Gestiona el personal de un proyecto (usuarios del sistema + contactos externos)
 */

import { useState, useEffect } from "react"
import { Plus, Trash2, UserCircle } from "lucide-react"
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
import { AlertCircle } from "lucide-react"
import api from "../../services/api"

const ROLES_PROYECTO = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'ingeniero', label: 'Ingeniero' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'colaborador', label: 'Colaborador' },
]

export default function ProjectMembers({ projectId }) {
  const [members, setMembers] = useState([])
  const [users, setUsers] = useState([])
  const [externalContacts, setExternalContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCreateExternalModal, setShowCreateExternalModal] = useState(false)

  // Form states
  const [memberType, setMemberType] = useState('usuario')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedExternalId, setSelectedExternalId] = useState('')
  const [selectedRol, setSelectedRol] = useState('colaborador')
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
      setError('Error al cargar personal')
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

  // Reset add modal
  const resetAddModal = () => {
    setMemberType('usuario')
    setSelectedUserId('')
    setSelectedExternalId('')
    setSelectedRol('colaborador')
  }

  // Add member (user or external)
  const handleAddMember = async () => {
    setSaving(true)
    try {
      if (memberType === 'usuario') {
        if (!selectedUserId) return
        const response = await api.post('/project-members', {
          project_id: projectId,
          user_id: parseInt(selectedUserId),
          rol_proyecto: selectedRol
        })
        if (response.data.success) {
          await loadMembers()
          setShowAddModal(false)
          resetAddModal()
        }
      } else {
        if (!selectedExternalId) return
        const response = await api.post('/project-members/external', {
          project_id: projectId,
          external_contact_id: parseInt(selectedExternalId),
          rol_proyecto: selectedRol
        })
        if (response.data.success) {
          await loadMembers()
          setShowAddModal(false)
          resetAddModal()
        }
      }
    } catch (err) {
      console.error('Error adding member:', err)
      setError(err.response?.data?.message || 'Error al agregar')
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
      setError(err.response?.data?.message || 'Error al crear contacto externo')
    } finally {
      setSaving(false)
    }
  }

  // Remove member
  const handleRemoveMember = async (memberId) => {
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

  // Format role display (handle old 'miembro' values)
  const formatRol = (rol) => {
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
                setMemberType(v)
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
                      availableExternals.map(contact => (
                        <SelectItem key={contact.id} value={contact.id.toString()}>
                          {contact.nombre} {contact.cargo ? `(${contact.cargo})` : ''}
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
