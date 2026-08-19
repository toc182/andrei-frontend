// Los archivos del proyecto: contrato, orden de proceder y lo demás que hasta
// ahora vivía fuera del sistema.
//
// Se trae y guarda lo suyo en vez de recibirlo por props: la pantalla de
// Información no necesita saber nada de archivos, y así esta tarjeta se puede
// mover de sitio sin arrastrar estado detrás.

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert } from '@/components/shell/Alert';
import { AppDialog } from '@/components/shell/AppDialog';
import { EmptyState } from '@/components/shell/states';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { cn } from '@/lib/utils';
import { formatDate } from '../../utils/dateUtils';

/** Lo que el servidor manda de cada documento. La clave de R2 no viaja. */
interface ProyectoDocumento {
  id: number;
  proyecto_id: number;
  nombre_original: string;
  /** Como lo llamamos aquí. Sin ella, el renglón se ve por el nombre. */
  etiqueta: string | null;
  tipo_mime: string;
  tamano: number;
  subido_por: number;
  subido_por_nombre: string | null;
  created_at: string;
}

/** El mismo tope que acepta el servidor. Se comprueba aquí también para no
 *  mandar 40 MB por la red y que los rechacen al llegar. */
const MAX_MB = 40;
const MAX_ARCHIVOS = 5;

const formatoTamano = (bytes: number): string =>
  (bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function ProyectoDocumentos({ projectId }: { projectId: number }) {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<ProyectoDocumento[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<ProyectoDocumento | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [editando, setEditando] = useState<ProyectoDocumento | null>(null);
  const [formEtiqueta, setFormEtiqueta] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/documentos`);
      setDocumentos(res.data.data ?? []);
    } catch {
      setError('No se pudieron cargar los documentos.');
      setDocumentos([]);
    }
  }, [projectId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const subir = async (archivos: FileList) => {
    setError(null);
    const lista = Array.from(archivos);

    if (lista.length > MAX_ARCHIVOS) {
      setError(`Se pueden subir ${MAX_ARCHIVOS} archivos a la vez como máximo.`);
      return;
    }
    const grande = lista.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (grande) {
      setError(`"${grande.name}" pesa más de ${MAX_MB} MB.`);
      return;
    }

    setSubiendo(true);
    try {
      const fd = new FormData();
      lista.forEach((f) => fd.append('archivos', f));
      await api.post(`/projects/${projectId}/documentos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await cargar();
    } catch {
      setError('No se pudo subir. Inténtalo otra vez.');
    } finally {
      setSubiendo(false);
    }
  };

  // El servidor devuelve un enlace temporal en vez de los bytes, así que el
  // archivo se abre en otra pestaña y de ahí se guarda.
  const descargar = async (doc: ProyectoDocumento) => {
    setError(null);
    try {
      const res = await api.get(`/projects/${projectId}/documentos/${doc.id}/download`);
      window.open(res.data.data.url, '_blank', 'noopener');
    } catch {
      setError('No se pudo abrir el archivo.');
    }
  };

  const abrirEditor = (doc: ProyectoDocumento) => {
    setEditando(doc);
    setFormEtiqueta(doc.etiqueta ?? '');
    setError(null);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    setError(null);
    try {
      await api.patch(`/projects/${projectId}/documentos/${editando.id}`, {
        etiqueta: formEtiqueta.trim(),
      });
      setEditando(null);
      await cargar();
    } catch {
      setError('No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!porBorrar) return;
    setBorrando(true);
    setError(null);
    try {
      await api.delete(`/projects/${projectId}/documentos/${porBorrar.id}`);
      setPorBorrar(null);
      await cargar();
    } catch {
      setError('No se pudo borrar el archivo.');
    } finally {
      setBorrando(false);
    }
  };

  // Quien lo subió lo puede quitar; por encima, admin y co-admin. El servidor
  // manda igual — esto solo evita enseñar un botón que va a dar error.
  const puedeBorrar = (doc: ProyectoDocumento): boolean =>
    doc.subido_por === user?.id || user?.rol === 'admin' || user?.rol === 'co-admin';

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documentos del Proyecto</CardTitle>
          <label
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              subiendo ? 'pointer-events-none opacity-50' : 'cursor-pointer',
            )}
          >
            {subiendo ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1 h-4 w-4" />
            )}
            Subir
            <input
              type="file"
              multiple
              className="hidden"
              disabled={subiendo}
              onChange={(e) => {
                const archivos = e.target.files;
                if (archivos && archivos.length > 0) subir(archivos);
                e.target.value = '';
              }}
            />
          </label>
        </CardHeader>

        <CardContent className="space-y-3">
          {error && <Alert variant="error" title={error} />}

          {documentos == null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Cargando documentos…
            </p>
          ) : documentos.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Sin documentos"
              description="Aquí van el contrato, la orden de proceder y cualquier otro archivo del proyecto."
            />
          ) : (
            <div className="space-y-1.5">
              {documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {/* Manda la etiqueta si la hay; si no, el nombre del archivo
                      sube a ocupar su sitio y no queda un renglón cojo. */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{doc.etiqueta || doc.nombre_original}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.etiqueta && <span>{doc.nombre_original} · </span>}
                      {doc.subido_por_nombre ?? 'Alguien'} · {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {formatoTamano(doc.tamano)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Abrir ${doc.nombre_original}`}
                    onClick={() => descargar(doc)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {puedeBorrar(doc) && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Editar ${doc.nombre_original}`}
                        onClick={() => abrirEditor(doc)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Borrar ${doc.nombre_original}`}
                        onClick={() => setPorBorrar(doc)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AppDialog
        open={editando != null}
        onOpenChange={(o) => { if (!o) setEditando(null); }}
        size="simple"
        title="Etiqueta del documento"
        description={
          editando
            ? `El archivo se sigue llamando ${editando.nombre_original}, y así se descarga.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setEditando(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardarEdicion} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="doc-etiqueta">Etiqueta</Label>
          <Input
            id="doc-etiqueta"
            value={formEtiqueta}
            maxLength={200}
            placeholder="Contrato firmado"
            onChange={(e) => setFormEtiqueta(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') guardarEdicion(); }}
          />
          <p className="text-xs text-muted-foreground">
            Déjala en blanco para que el documento se vea por su nombre de archivo.
          </p>
        </div>
      </AppDialog>

      <AlertDialog open={porBorrar != null} onOpenChange={(o) => !o && setPorBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina «{porBorrar?.nombre_original}» del proyecto. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                borrar();
              }}
              disabled={borrando}
            >
              {borrando ? 'Borrando…' : 'Borrar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
