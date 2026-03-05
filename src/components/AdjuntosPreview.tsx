import { useState, useEffect, useRef } from "react"
import { Paperclip, Plus, Trash2, FileText, ExternalLink, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import api from "../services/api"
import type { SolicitudPagoAdjunto } from "../types/api"

interface AdjuntosPreviewProps {
  adjuntos: SolicitudPagoAdjunto[]
  solicitudPagoId: number
  onUpload?: (files: FileList) => void
  onDelete?: (id: number) => void
  uploading?: boolean
  readOnly?: boolean
  title?: string
}

interface AdjuntoUrl {
  id: number
  url: string
  tipo_mime: string
}

export default function AdjuntosPreview({
  adjuntos,
  solicitudPagoId,
  onUpload,
  onDelete,
  uploading,
  readOnly = false,
  title = "Adjuntos",
}: AdjuntosPreviewProps) {
  const [adjuntoUrls, setAdjuntoUrls] = useState<AdjuntoUrl[]>([])
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxName, setLightboxName] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch signed URLs when adjuntos change
  useEffect(() => {
    if (adjuntos.length === 0) {
      setAdjuntoUrls([])
      return
    }
    const fetchUrls = async () => {
      try {
        setLoadingUrls(true)
        const response = await api.get(`/solicitudes-pago/${solicitudPagoId}/adjuntos/urls`)
        if (response.data.success) {
          setAdjuntoUrls(response.data.adjuntos)
        }
      } catch (err) {
        console.error("Error fetching adjunto URLs:", err)
      } finally {
        setLoadingUrls(false)
      }
    }
    fetchUrls()
  }, [adjuntos, solicitudPagoId])

  const getUrl = (adjuntoId: number): string | undefined => {
    return adjuntoUrls.find((u) => u.id === adjuntoId)?.url
  }

  const isImage = (tipoMime: string) =>
    tipoMime === "image/jpeg" || tipoMime === "image/png"

  const isPdf = (tipoMime: string) => tipoMime === "application/pdf"

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  const imageAdjuntos = adjuntos.filter((a) => isImage(a.tipo_mime))
  const pdfAdjuntos = adjuntos.filter((a) => isPdf(a.tipo_mime))

  const openLightbox = (url: string, name: string) => {
    setLightboxUrl(url)
    setLightboxName(name)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> {title}
        </h4>
        {!readOnly && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && onUpload?.(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Plus className="h-3 w-3 mr-1" />
              {uploading ? "Subiendo..." : "Adjuntar"}
            </Button>
          </div>
        )}
      </div>

      {adjuntos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin adjuntos</p>
      ) : loadingUrls ? (
        <p className="text-sm text-muted-foreground">Cargando previews...</p>
      ) : (
        <div className="space-y-4">
          {/* Image Grid */}
          {imageAdjuntos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {imageAdjuntos.map((adj) => {
                const url = getUrl(adj.id)
                return (
                  <div key={adj.id} className="relative group border rounded-lg overflow-hidden">
                    {url ? (
                      <img
                        src={url}
                        alt={adj.nombre_original}
                        className="w-full h-28 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openLightbox(url, adj.nombre_original)}
                      />
                    ) : (
                      <div className="w-full h-28 bg-muted flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center justify-between">
                      <span className="text-xs text-white truncate flex-1">
                        {adj.nombre_original}
                      </span>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 shrink-0 text-white/70 hover:text-red-400 hover:bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete?.(adj.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* PDF Viewers */}
          {pdfAdjuntos.map((adj) => {
            const url = getUrl(adj.id)
            return (
              <div key={adj.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-red-600" />
                    <span className="text-sm truncate">{adj.nombre_original}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(adj.tamano / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Abrir
                      </Button>
                    )}
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete?.(adj.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {url && !isMobile && (
                  <iframe
                    src={url}
                    title={adj.nombre_original}
                    className="w-full h-[300px] border-t"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Image Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Ver imagen</DialogTitle>
            <DialogDescription>{lightboxName}</DialogDescription>
          </DialogHeader>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt={lightboxName}
              className="w-full h-full object-contain max-h-[85vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
