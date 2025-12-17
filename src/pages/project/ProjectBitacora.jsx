/**
 * ProjectBitacora Component
 * Project log/journal with entries, comments, and photo attachments
 */

import { useState, useEffect, useRef } from "react"
import {
  Plus, Send, Trash2, MessageSquare, Image, X, ChevronRight, Paperclip
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import api from "../../services/api"

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatRelativeTime = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return formatDate(dateString)
}

// Parse @mentions in text
const parseMentions = (text, members = []) => {
  if (!text) return text
  const mentionRegex = /@(\w+)/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const memberName = match[1]
    const isMember = members.some(m =>
      (m.nombre_display || m.nombre || '').toLowerCase().includes(memberName.toLowerCase())
    )
    parts.push(
      <span key={match.index} className={isMember ? "bg-blue-100 text-blue-700 px-1 rounded" : ""}>
        @{memberName}
      </span>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}

// Truncate text for preview
const truncateText = (text, maxLength = 120) => {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

export default function ProjectBitacora({ projectId }) {
  const [entries, setEntries] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  // New entry form
  const [showForm, setShowForm] = useState(false)
  const [newEntry, setNewEntry] = useState({ titulo: '', contenido: '' })
  const [selectedFiles, setSelectedFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  // Detail modal
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [entryComments, setEntryComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentFiles, setCommentFiles] = useState([])
  const [sendingComment, setSendingComment] = useState(false)
  const commentFileInputRef = useRef(null)

  // Image viewer
  const [viewingImage, setViewingImage] = useState(null)

  useEffect(() => {
    loadEntries()
    loadMembers()
  }, [projectId])

  const loadEntries = async (loadMore = false) => {
    try {
      if (!loadMore) setLoading(true)
      const currentOffset = loadMore ? offset : 0

      const response = await api.get(`/project-bitacora/projects/${projectId}?limit=${LIMIT}&offset=${currentOffset}`)

      if (response.data.success) {
        if (loadMore) {
          setEntries(prev => [...prev, ...response.data.entries])
        } else {
          setEntries(response.data.entries)
        }
        setHasMore(response.data.entries.length === LIMIT)
        setOffset(currentOffset + response.data.entries.length)
      }
    } catch (error) {
      console.error('Error loading entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async () => {
    try {
      const response = await api.get(`/project-members/project/${projectId}`)
      if (response.data.success) {
        setMembers(response.data.members)
      }
    } catch (error) {
      console.error('Error loading members:', error)
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setSelectedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!newEntry.contenido.trim()) return

    try {
      setSaving(true)
      const formData = new FormData()
      formData.append('contenido', newEntry.contenido.trim())
      if (newEntry.titulo.trim()) {
        formData.append('titulo', newEntry.titulo.trim())
      }
      selectedFiles.forEach(file => {
        formData.append('fotos', file)
      })

      const response = await api.post(`/project-bitacora/projects/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data.success) {
        setEntries(prev => [response.data.entry, ...prev])
        setNewEntry({ titulo: '', contenido: '' })
        setSelectedFiles([])
        setShowForm(false)
      }
    } catch (error) {
      console.error('Error creating entry:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entryId) => {
    if (!confirm('¿Eliminar esta entrada?')) return

    try {
      await api.delete(`/project-bitacora/${entryId}`)
      setEntries(prev => prev.filter(e => e.id !== entryId))
      setSelectedEntry(null)
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  // Open entry detail
  const openEntryDetail = async (entry) => {
    setSelectedEntry(entry)
    setEntryComments([])
    setNewComment('')
    setCommentFiles([])
    loadEntryComments(entry.id)
  }

  const loadEntryComments = async (entryId) => {
    try {
      setLoadingComments(true)
      const response = await api.get(`/project-bitacora/${entryId}`)
      if (response.data.success) {
        setEntryComments(response.data.entry.comments || [])
      }
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  const handleCommentFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setCommentFiles(prev => [...prev, ...files])
  }

  const removeCommentFile = (index) => {
    setCommentFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddComment = async () => {
    if (!newComment.trim() && commentFiles.length === 0) return
    if (!selectedEntry) return

    try {
      setSendingComment(true)

      const formData = new FormData()
      formData.append('contenido', newComment.trim() || ' ')
      commentFiles.forEach(file => {
        formData.append('fotos', file)
      })

      const response = await api.post(`/project-bitacora/${selectedEntry.id}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data.success) {
        setEntryComments(prev => [...prev, response.data.comment])
        setNewComment('')
        setCommentFiles([])
        // Update comment count in entries list
        setEntries(prev => prev.map(e =>
          e.id === selectedEntry.id ? { ...e, comment_count: (e.comment_count || 0) + 1 } : e
        ))
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setSendingComment(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!selectedEntry) return

    try {
      await api.delete(`/project-bitacora/comments/${commentId}`)
      setEntryComments(prev => prev.filter(c => c.id !== commentId))
      setEntries(prev => prev.map(e =>
        e.id === selectedEntry.id ? { ...e, comment_count: Math.max(0, (e.comment_count || 1) - 1) } : e
      ))
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando bitácora...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Bitácora del Proyecto</h2>
          <p className="text-sm text-muted-foreground">{entries.length} entradas</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Entrada
        </Button>
      </div>

      {/* Entries List - Compact Preview Cards */}
      <div className="space-y-2">
        {entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay entradas en la bitácora. Crea la primera entrada para comenzar.
            </CardContent>
          </Card>
        ) : (
          entries.map(entry => (
            <Card
              key={entry.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openEntryDetail(entry)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title or first line */}
                    <div className="flex items-center gap-2">
                      {entry.titulo ? (
                        <span className="font-medium text-sm truncate">{entry.titulo}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground truncate">
                          {truncateText(entry.contenido, 60)}
                        </span>
                      )}
                    </div>
                    {/* Meta info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{entry.creador_nombre}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(entry.created_at)}</span>
                      {entry.comment_count > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {entry.comment_count}
                          </span>
                        </>
                      )}
                      {entry.attachment_count > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Image className="h-3 w-3" />
                            {entry.attachment_count}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Load More */}
        {hasMore && (
          <div className="text-center pt-2">
            <Button variant="outline" size="sm" onClick={() => loadEntries(true)}>
              Cargar más
            </Button>
          </div>
        )}
      </div>

      {/* New Entry Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nueva Entrada</DialogTitle>
            <DialogDescription className="sr-only">
              Crear una nueva entrada en la bitácora del proyecto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título (opcional)</Label>
              <Input
                value={newEntry.titulo}
                onChange={(e) => setNewEntry(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Título de la entrada"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Contenido *</Label>
              <Textarea
                value={newEntry.contenido}
                onChange={(e) => setNewEntry(prev => ({ ...prev, contenido: e.target.value }))}
                placeholder="Escribe aquí... Usa @nombre para mencionar a alguien"
                className="mt-1 min-h-[120px]"
              />
            </div>

            {/* File upload */}
            <div>
              <Label>Fotos</Label>
              <div className="mt-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Agregar fotos
                </Button>

                {/* Preview selected files */}
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-16 w-16 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!newEntry.contenido.trim() || saving}>
              {saving ? 'Guardando...' : 'Publicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry Detail Modal */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedEntry?.titulo || 'Entrada'}</DialogTitle>
            <DialogDescription className="sr-only">
              Detalle de la entrada de bitácora
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Entry info */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedEntry.creador_nombre}</span>
                  <span>·</span>
                  <span title={formatDate(selectedEntry.created_at)}>
                    {formatRelativeTime(selectedEntry.created_at)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(selectedEntry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="text-sm whitespace-pre-wrap">
                {parseMentions(selectedEntry.contenido, members)}
              </div>

              {/* Photos */}
              {selectedEntry.attachments && selectedEntry.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Fotos</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.attachments.map(att => (
                      <button
                        key={att.id}
                        onClick={() => setViewingImage(`${API_BASE}/uploads/bitacora/${att.filepath}`)}
                        className="relative group"
                      >
                        <img
                          src={`${API_BASE}/uploads/bitacora/${att.filepath}`}
                          alt={att.filename}
                          className="h-24 w-24 object-cover rounded border hover:opacity-90 transition"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments section */}
              <div className="border-t pt-4 space-y-3">
                <Label className="text-xs text-muted-foreground">
                  Comentarios ({entryComments.length})
                </Label>

                {loadingComments ? (
                  <div className="text-sm text-muted-foreground">Cargando...</div>
                ) : (
                  <div className="space-y-2">
                    {entryComments.map(comment => (
                      <div key={comment.id} className="bg-muted/30 rounded p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium">{comment.creador_nombre}</span>
                              <span className="text-muted-foreground">
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                            {comment.contenido && comment.contenido.trim() && (
                              <div className="text-sm mt-0.5">
                                {parseMentions(comment.contenido, members)}
                              </div>
                            )}
                            {/* Comment attachments */}
                            {comment.attachments && comment.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {comment.attachments.map(att => (
                                  <button
                                    key={att.id}
                                    onClick={() => setViewingImage(`${API_BASE}/uploads/bitacora/${att.filepath}`)}
                                  >
                                    <img
                                      src={`${API_BASE}/uploads/bitacora/${att.filepath}`}
                                      alt={att.filename}
                                      className="h-16 w-16 object-cover rounded border hover:opacity-90 transition"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add comment with photo support */}
                <div className="space-y-2">
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
                    <input
                      type="file"
                      ref={commentFileInputRef}
                      onChange={handleCommentFileSelect}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => commentFileInputRef.current?.click()}
                      title="Agregar foto"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleAddComment}
                      disabled={(!newComment.trim() && commentFiles.length === 0) || sendingComment}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Preview comment files */}
                  {commentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {commentFiles.map((file, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="h-12 w-12 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() => removeCommentFile(index)}
                            className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Viewer */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Ver imagen</DialogTitle>
            <DialogDescription>Imagen ampliada</DialogDescription>
          </DialogHeader>
          {viewingImage && (
            <img
              src={viewingImage}
              alt="Imagen ampliada"
              className="w-full h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
