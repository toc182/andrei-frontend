/**
 * Los archivos de una orden de compra: la cotización, los de cada factura y lo
 * demás que se le cuelgue (Ivan, 2026-10-23: «todavía no entiendo cuántos
 * adjuntos hay… debe ser una línea por archivo, y uno debe poder darle nombre al
 * archivo»).
 *
 * Una línea por archivo, con el nombre que alguien le puso —o el del archivo si
 * nadie le puso uno— y debajo de dónde salió. El nombre se cambia ahí mismo, en
 * su línea. «Adjuntar» va en el encabezado, afuera del recuadro, y los archivos
 * también se pueden soltar sobre la lista.
 *
 * Solo la orden de compra: AdjuntosPreview, el de las solicitudes y las
 * cotizaciones, sigue como estaba.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Check, Download, FileText, Image as ImageIcon, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import api from '@/services/api';
import { fechaDeMomento } from '@/lib/fechas';
import { useSoltarArchivos } from '@/hooks/useSoltarArchivos';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Alert, EmptyState, SectionHeader } from '@/components/shell';
import { nombreFactura } from './formato';
import { abrirAdjunto } from './adjuntos';
import type { OrdenAdjunto, OrdenDetalle } from './tiposDetalle';

/** Los mismos que acepta el servidor (menos webp, que nadie manda). */
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png'];

const tamanoDe = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const nombreDe = (a: OrdenAdjunto) => a.descripcion || a.nombre_original;

const mensajeDe = (e: unknown, otro: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? otro;

interface Props {
  orden: OrdenDetalle;
  /** Vuelve a traer la orden después de subir, renombrar o borrar. */
  onCambio: () => void;
}

export default function DocumentosOrden({ orden, onCambio }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<OrdenAdjunto | null>(null);
  const [borrando, setBorrando] = useState(false);
  const elegir = useRef<HTMLInputElement>(null);

  // Los de la orden y los de cada factura, en el orden en que se subieron.
  const facturaDe = new Map(orden.entregas.map((f) => [f.id, f]));
  const archivos = [...orden.adjuntos, ...orden.entregas.flatMap((f) => f.adjuntos)].sort(
    (a, b) => a.id - b.id,
  );

  const subir = async (lista: File[]) => {
    if (lista.length === 0) return;
    setSubiendo(true);
    setError(null);
    try {
      for (const archivo of lista) {
        const fd = new FormData();
        fd.append('archivo', archivo);
        await api.post(`/ordenes-compra/${orden.id}/adjuntos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo subir el archivo'));
    } finally {
      setSubiendo(false);
      onCambio();
    }
  };

  const { encima, props: zona } = useSoltarArchivos({
    tipos: TIPOS,
    activo: !subiendo,
    alSoltar: (aceptados, rechazados) => {
      setError(
        rechazados.length
          ? `${rechazados.map((f) => f.name).join(', ')}: solo se adjuntan PDF, JPG y PNG.`
          : null,
      );
      void subir(aceptados);
    },
  });

  const abrir = async (a: OrdenAdjunto) => {
    setError(null);
    if (!(await abrirAdjunto(orden.id, a.id))) setError('No se pudo abrir el archivo');
  };

  const empezarAEditar = (a: OrdenAdjunto) => {
    setEditando(a.id);
    setNombre(a.descripcion ?? '');
    setError(null);
  };

  const guardarNombre = async (e: FormEvent) => {
    e.preventDefault();
    if (editando === null) return;
    setGuardando(true);
    setError(null);
    try {
      await api.patch(`/ordenes-compra/${orden.id}/adjuntos/${editando}`, {
        descripcion: nombre.trim(),
      });
      setEditando(null);
      onCambio();
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo cambiar el nombre'));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!porBorrar) return;
    setBorrando(true);
    setError(null);
    try {
      await api.delete(`/ordenes-compra/${orden.id}/adjuntos/${porBorrar.id}`);
      setPorBorrar(null);
      onCambio();
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo borrar el archivo'));
    } finally {
      setBorrando(false);
    }
  };

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Documentos"
        count={archivos.length}
        action={
          <>
            <input
              ref={elegir}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(e) => {
                const lista = Array.from(e.target.files ?? []);
                e.target.value = '';
                void subir(lista);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => elegir.current?.click()}
              disabled={subiendo}
            >
              <Plus className="mr-1 h-4 w-4" />
              {subiendo ? 'Subiendo…' : 'Adjuntar'}
            </Button>
          </>
        }
      />

      {error && <Alert variant="error" title={error} />}

      <Card className="relative px-5 py-1" {...zona}>
        {archivos.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            title="Sin documentos"
            description="La cotización, las facturas y cualquier otro archivo de la orden."
          />
        ) : (
          archivos.map((a) => {
            const factura = a.entrega_id ? facturaDe.get(a.entrega_id) : undefined;
            const Icono = a.tipo_mime?.startsWith('image/') ? ImageIcon : FileText;
            const detalle = [
              a.descripcion ? a.nombre_original : null,
              tamanoDe(a.tamano),
              a.subido_por_nombre,
              fechaDeMomento(a.created_at),
              factura ? nombreFactura(factura) : null,
            ].filter(Boolean);

            return (
              <div
                key={a.id}
                className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0"
              >
                <Icono className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {editando === a.id ? (
                  <form onSubmit={(e) => void guardarNombre(e)} className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={nombre}
                        maxLength={255}
                        placeholder={a.nombre_original}
                        aria-label={`Nombre de ${a.nombre_original}`}
                        onChange={(e) => setNombre(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditando(null);
                        }}
                        disabled={guardando}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-success hover:text-success"
                        title="Guardar el nombre"
                        aria-label="Guardar el nombre"
                        disabled={guardando}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Cancelar"
                        aria-label="Cancelar"
                        onClick={() => setEditando(null)}
                        disabled={guardando}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      En blanco, se ve el nombre del archivo.
                    </p>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground wrap-anywhere">{nombreDe(a)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground wrap-anywhere">
                        {detalle.join(' · ')}
                      </p>
                    </div>
                    <div className="-my-0.5 flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-navy hover:bg-navy/10"
                        title="Bajar"
                        aria-label={`Bajar ${nombreDe(a)}`}
                        onClick={() => void abrir(a)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Cambiar el nombre"
                        aria-label={`Cambiar el nombre de ${nombreDe(a)}`}
                        onClick={() => empezarAEditar(a)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-error"
                        title="Borrar"
                        aria-label={`Borrar ${nombreDe(a)}`}
                        onClick={() => setPorBorrar(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}

        {encima && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-teal bg-card/90 text-sm font-semibold text-teal">
            Suelta los archivos para adjuntarlos
          </div>
        )}
      </Card>

      <AlertDialog open={porBorrar !== null} onOpenChange={(o) => !o && setPorBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina «{porBorrar ? nombreDe(porBorrar) : ''}» de la orden {orden.numero}. No se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void borrar();
              }}
              disabled={borrando}
            >
              {borrando ? 'Borrando…' : 'Borrar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
