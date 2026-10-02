import { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppDialog } from '@/components/shell/AppDialog';
import api from '../services/api';
import { useSoltarArchivos } from '@/hooks/useSoltarArchivos';
import type { SolicitudPagoAdjunto } from '../types/api';

/** Lo único que el recuadro mira de cada archivo. Así sirve igual para una
 *  solicitud de pago que para una orden de compra. */
type AdjuntoVisible = Pick<SolicitudPagoAdjunto, 'id' | 'nombre_original' | 'tipo_mime' | 'tamano'>;

interface AdjuntosPreviewProps {
  adjuntos: AdjuntoVisible[];
  solicitudPagoId?: number;
  /** De dónde salen los enlaces para abrir los archivos. Sin esto, los de la
   *  solicitud de pago `solicitudPagoId`. */
  rutaUrls?: string;
  onUpload?: (files: FileList) => void;
  onDelete?: (id: number) => void;
  uploading?: boolean;
  readOnly?: boolean;
  title?: string;
}

interface AdjuntoUrl {
  id: number;
  url: string;
  tipo_mime: string;
}

export default function AdjuntosPreview({
  adjuntos,
  solicitudPagoId,
  rutaUrls,
  onUpload,
  onDelete,
  uploading,
  readOnly = false,
  title = 'Adjuntos',
}: AdjuntosPreviewProps) {
  const [adjuntoUrls, setAdjuntoUrls] = useState<AdjuntoUrl[]>([]);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ruta = rutaUrls ?? `/solicitudes-pago/${solicitudPagoId}/adjuntos/urls`;

  // Además del botón, se pueden arrastrar los archivos y soltarlos en el recuadro.
  const puedeSoltar = !readOnly && !!onUpload && !uploading;
  const [rechazo, setRechazo] = useState<string | null>(null);
  const { encima, props: zona } = useSoltarArchivos({
    tipos: ['application/pdf', 'image/jpeg', 'image/png'],
    activo: puedeSoltar,
    alSoltar: (aceptados, rechazados) => {
      setRechazo(
        rechazados.length
          ? `${rechazados.map((f) => f.name).join(', ')}: solo se adjuntan PDF, JPG y PNG.`
          : null,
      );
      if (aceptados.length === 0) return;
      // Quien recibe espera un FileList, como el del botón.
      const lista = new DataTransfer();
      aceptados.forEach((f) => lista.items.add(f));
      onUpload?.(lista.files);
    },
  });

  useEffect(() => {
    if (adjuntos.length === 0) {
      setAdjuntoUrls([]);
      return;
    }
    const fetchUrls = async () => {
      try {
        setLoadingUrls(true);
        const response = await api.get(ruta);
        if (response.data.success) {
          setAdjuntoUrls(response.data.adjuntos);
        }
      } catch (err) {
        console.error('Error fetching adjunto URLs:', err);
      } finally {
        setLoadingUrls(false);
      }
    };
    fetchUrls();
  }, [adjuntos, ruta]);

  const getUrl = (adjuntoId: number): string | undefined => {
    return adjuntoUrls.find((u) => u.id === adjuntoId)?.url;
  };

  const isImage = (tipoMime: string) =>
    tipoMime === 'image/jpeg' || tipoMime === 'image/png';

  return (
    <div className="relative space-y-3 rounded-lg" {...zona}>
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
              {uploading ? 'Subiendo...' : 'Adjuntar'}
            </Button>
          </div>
        )}
      </div>

      {rechazo && <p className="text-xs text-error">{rechazo}</p>}

      {adjuntos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {puedeSoltar ? 'Sin adjuntos. Arrastra los archivos aquí o usa Adjuntar.' : 'Sin adjuntos'}
        </p>
      ) : loadingUrls ? (
        <p className="text-sm text-muted-foreground">Cargando previews...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {adjuntos.map((adj) => {
            const url = getUrl(adj.id);
            const image = isImage(adj.tipo_mime);

            return (
              <div
                key={adj.id}
                className="relative group border rounded-lg overflow-hidden cursor-pointer w-20 h-20"
                onClick={() => {
                  if (!url) return;
                  if (image) {
                    setLightboxUrl(url);
                    setLightboxName(adj.nombre_original);
                  } else {
                    window.open(url, '_blank');
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
                    <FileText className="h-7 w-7 text-error" />
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
                      className="h-4 w-4 p-0 shrink-0 text-white/70 hover:text-error hover:bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(adj.id);
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {encima && (
        <div className="pointer-events-none absolute -inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-teal bg-card/90 text-sm font-semibold text-teal">
          Suelta los archivos para adjuntarlos
        </div>
      )}

      {/* Image Lightbox */}
      <AppDialog
        open={!!lightboxUrl}
        onOpenChange={() => setLightboxUrl(null)}
        size="detail"
        title="Ver imagen"
        description={lightboxName}
      >
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt={lightboxName}
              className="w-full h-full object-contain max-h-[85vh]"
            />
          )}
      </AppDialog>
    </div>
  );
}
