import { useState, useEffect, useRef } from "react"
import { Paperclip, Plus, Trash2, FileText, Image as ImageIcon } from "lucide-react"
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
        <div className="flex flex-wrap gap-2">
          {adjuntos.map((adj) => {
            const url = getUrl(adj.id)
            const image = isImage(adj.tipo_mime)

            return (
              <div
                key={adj.id}
                className="relative group border rounded-lg overflow-hidden cursor-pointer w-20 h-20"
                onClick={() => {
                  if (!url) return
                  if (image) {
                    setLightboxUrl(url)
                    setLightboxName(adj.nombre_original)
                  } else {
                    window.open(url, "_blank")
                  }
                }}
              >
                {image ? (
                  url ? (
                    <img
                      src={url}
                      alt={adj.nombre_original}
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-muted/50 flex flex-col items-center justify-center gap-0.5">
                    <FileText className="h-7 w-7 text-red-600" />
                    <span className="text-[10px] text-muted-foreground">
                      {(adj.tamano / 1024).toFixed(0)} KB
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 flex items-center justify-between">
                  <span className="text-[10px] text-white truncate flex-1">
                    {adj.nombre_original}
                  </span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 shrink-0 text-white/70 hover:text-red-400 hover:bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete?.(adj.id)
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
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
