// Existing-files preview for one oferta: fetches the file list + signed
// URLs from the cotizaciones endpoints, renders thumbnails (image →
// lightbox, pdf → open), and supports upload + delete. Cotizaciones
// equivalent of AdjuntosPreview (which is hardwired to solicitudes).

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Paperclip,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppDialog } from '@/components/shell';
import api from '@/services/api';
import type { CotizacionArchivo, CotizacionArchivoUrl } from '@/types/api';

interface Props {
  ofertaId: number;
  readOnly?: boolean;
  onChanged?: () => void; // notify parent so archivo counts refresh
}

export function CotizacionArchivos({ ofertaId, readOnly = false, onChanged }: Props) {
  const [archivos, setArchivos] = useState<CotizacionArchivo[]>([]);
  const [urls, setUrls] = useState<CotizacionArchivoUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, urlsRes] = await Promise.all([
        api.get(`/cotizaciones/ofertas/${ofertaId}/archivos`),
        api.get(`/cotizaciones/ofertas/${ofertaId}/archivos/urls`),
      ]);
      setArchivos(listRes.data.data ?? []);
      setUrls(urlsRes.data.data ?? []);
    } catch (err) {
      console.error('Error loading archivos:', err);
    } finally {
      setLoading(false);
    }
  }, [ofertaId]);

  useEffect(() => {
    load();
  }, [load]);

  const getUrl = (id: number) => urls.find((u) => u.id === id)?.url;
  const isImage = (mime: string | null) =>
    mime === 'image/jpeg' || mime === 'image/png';

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append('archivos', f));
      await api.post(`/cotizaciones/ofertas/${ofertaId}/archivos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await load();
      onChanged?.();
    } catch (err) {
      console.error('Error uploading archivos:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/cotizaciones/archivos/${id}`);
      await load();
      onChanged?.();
    } catch (err) {
      console.error('Error deleting archivo:', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" /> Archivos
        </h4>
        {!readOnly && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Plus className="mr-1 h-3 w-3" />
              {uploading ? 'Subiendo...' : 'Agregar archivo'}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : archivos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin archivos</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {archivos.map((a) => {
            const url = getUrl(a.id);
            const image = isImage(a.tipo_mime);
            return (
              <div
                key={a.id}
                className="group relative h-20 w-20 cursor-pointer overflow-hidden rounded-lg border"
                onClick={() => {
                  if (!url) return;
                  if (image) {
                    setLightboxUrl(url);
                    setLightboxName(a.nombre_original);
                  } else {
                    window.open(url, '_blank');
                  }
                }}
              >
                {image && url ? (
                  <img
                    src={url}
                    alt={a.nombre_original}
                    className="h-full w-full object-cover transition-opacity hover:opacity-90"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-muted/50">
                    {image ? (
                      <ImageIcon className="h-7 w-7 text-info" />
                    ) : (
                      <FileText className="h-7 w-7 text-error" />
                    )}
                    {a.tamano != null && (
                      <span className="text-[10px] text-muted-foreground">
                        {(a.tamano / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-1 py-0.5">
                  <span className="flex-1 truncate text-[10px] text-white">
                    {a.nombre_original}
                  </span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 shrink-0 p-0 text-white/70 hover:bg-transparent hover:text-error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(a.id);
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
            className="max-h-[85vh] w-full object-contain"
          />
        )}
      </AppDialog>
    </div>
  );
}
