/**
 * Escribir una requisición, o corregirla antes de que la aprueben.
 *
 * Es la misma ventana para las dos cosas y para las dos personas:
 *   * Quien la escribe (Cecilia): al crearla pasa a aprobación; al corregirla,
 *     lo que cambie queda en la historia.
 *   * Quien la aprueba (Hilario): si la corrige él, queda aprobada al guardar
 *     (Ivan, 2026-10-02), y por eso le pide su contraseña. Si la escribe él
 *     mismo, sale aprobada igual.
 *
 * La forma copia la de la orden de compra (OrdenFormDialog), que Ivan aprobó:
 * las líneas son una tabla donde se escribe en la casilla (LineasGrid) y los
 * datos bancarios son los mismos cuatro de la solicitud de pago, que pasan tal
 * cual a la solicitud que salga de aquí.
 */
import { useEffect, useRef, useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import api from '@/services/api';
import { AppDialog, Alert, DatePicker } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BulkApprovalPasswordDialog } from '@/pages/solicitudes/dialogs/BulkApprovalPasswordDialog';
import { useSoltarArchivos } from '@/hooks/useSoltarArchivos';
import { cn } from '@/lib/utils';
import { LineasGrid } from './LineasGrid';
import { lineaEnBlanco, lineaVacia } from './lineas';
import { PrioridadEtiqueta } from './etiquetas';
import type { LineaBorrador, Prioridad, RequisicionDetalle } from './tipos';

const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ARCHIVO_MAX = 10 * 1024 * 1024;
const SIN_TIPO = 'sin_tipo';

interface ArchivoNuevo {
  archivo: File;
  descripcion: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proyectoId: number;
  proyectoNombre?: string;
  /** Si viene, se corrige esta; si no, se escribe una nueva. */
  requisicion?: RequisicionDetalle | null;
  /** Si quien escribe es el que aprueba las del proyecto: guarda y aprueba. */
  esAprobador: boolean;
  /** Ya guardada. `sinSubir`: los archivos que no se pudieron subir, para avisar. */
  onListo: (id: number, sinSubir: string[]) => void;
}

/** «1,000.5» o «1000,5» → 1000.5. La coma de miles es la de Panamá. */
function aNumero(texto: string): number {
  const limpio = texto.trim().replace(/,/g, '');
  return limpio === '' ? NaN : Number(limpio);
}

export default function RequisicionFormDialog({
  open,
  onOpenChange,
  proyectoId,
  proyectoNombre,
  requisicion,
  esAprobador,
  onListo,
}: Props) {
  const editando = !!requisicion;
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState('');
  const [prioridad, setPrioridad] = useState<Prioridad>('normal');
  const [lineas, setLineas] = useState<LineaBorrador[]>([lineaVacia()]);
  const [notas, setNotas] = useState('');
  const [beneficiario, setBeneficiario] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState(SIN_TIPO);
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [archivos, setArchivos] = useState<ArchivoNuevo[]>([]);
  const [quitados, setQuitados] = useState<number[]>([]);
  const [rechazados, setRechazados] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [lineasMalas, setLineasMalas] = useState<Set<number>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [clave, setClave] = useState('');
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);

  // Cada vez que se abre, desde lo que hay: la requisición que se corrige, o en
  // blanco.
  useEffect(() => {
    if (!open) return;
    const r = requisicion;
    setDescripcion(r?.descripcion ?? '');
    setFecha(r?.fecha_requerida ?? '');
    setPrioridad(r?.prioridad ?? 'normal');
    setLineas(
      r?.lineas.length
        ? r.lineas.map((l) => ({
            clave: `l${l.id}`,
            cantidad: String(Number(l.cantidad)),
            unidad: l.unidad ?? '',
            descripcion: l.descripcion,
            renglon_desglose: l.renglon_desglose ?? '',
          }))
        : [lineaVacia()],
    );
    setNotas(r?.notas ?? '');
    setBeneficiario(r?.beneficiario ?? '');
    setBanco(r?.banco ?? '');
    setTipoCuenta(r?.tipo_cuenta ?? SIN_TIPO);
    setNumeroCuenta(r?.numero_cuenta ?? '');
    setArchivos([]);
    setQuitados([]);
    setRechazados(null);
    setError(null);
    setLineasMalas(new Set());
    setClave('');
    setErrorClave(null);
  }, [open, requisicion]);

  const agregarArchivos = (lista: File[]) => {
    const buenos: ArchivoNuevo[] = [];
    const malos: string[] = [];
    for (const f of lista) {
      if (!TIPOS_ARCHIVO.includes(f.type)) malos.push(`${f.name}: solo PDF, JPG, PNG o WEBP`);
      else if (f.size > ARCHIVO_MAX) malos.push(`${f.name}: pasa de 10 MB`);
      else buenos.push({ archivo: f, descripcion: '' });
    }
    setArchivos((a) => [...a, ...buenos]);
    setRechazados(malos.length ? malos.join(' · ') : null);
  };
  const { encima, props: zona } = useSoltarArchivos({
    tipos: TIPOS_ARCHIVO,
    activo: open && !guardando,
    alSoltar: (aceptados, rech) => {
      agregarArchivos([...aceptados, ...rech]);
    },
  });

  /** Lo que se manda, o el error para la persona. */
  const armar = (): { cuerpo: Record<string, unknown> } | { error: string; malas?: Set<number> } => {
    if (!descripcion.trim()) return { error: 'Falta la descripción' };
    if (!fecha) return { error: 'Falta la fecha requerida' };
    const escritas = lineas.map((l, i) => ({ l, i })).filter(({ l }) => !lineaEnBlanco(l));
    if (escritas.length === 0) return { error: 'La requisición necesita al menos una línea' };
    const malas = new Set<number>();
    for (const { l, i } of escritas) {
      const n = aNumero(l.cantidad);
      if (!l.descripcion.trim() || !Number.isFinite(n) || n <= 0) malas.add(i);
    }
    if (malas.size) {
      return { error: 'Cada línea necesita descripción y una cantidad mayor que cero', malas };
    }
    return {
      cuerpo: {
        descripcion: descripcion.trim(),
        fecha_requerida: fecha,
        prioridad,
        notas: notas.trim() || null,
        beneficiario: beneficiario.trim() || null,
        banco: banco.trim() || null,
        tipo_cuenta: tipoCuenta === SIN_TIPO ? null : tipoCuenta,
        numero_cuenta: numeroCuenta.trim() || null,
        lineas: escritas.map(({ l }) => ({
          cantidad: aNumero(l.cantidad),
          unidad: l.unidad.trim() || null,
          descripcion: l.descripcion.trim(),
          renglon_desglose: l.renglon_desglose.trim() || null,
        })),
      },
    };
  };

  const guardar = async (password?: string) => {
    const armado = armar();
    if ('error' in armado) {
      setError(armado.error);
      setLineasMalas(armado.malas ?? new Set());
      return;
    }
    if (esAprobador && password === undefined) {
      setClave('');
      setErrorClave(null);
      setPidiendoClave(true);
      return;
    }
    setError(null);
    setLineasMalas(new Set());
    setGuardando(true);
    try {
      const conClave = esAprobador ? { password } : {};
      let id: number;
      if (editando) {
        await api.put(`/requisiciones/${requisicion!.id}`, { ...armado.cuerpo, ...conClave });
        id = requisicion!.id;
      } else {
        const res = await api.post('/requisiciones', {
          ...armado.cuerpo,
          proyecto_id: proyectoId,
          ...(esAprobador ? { aprobar: true, password } : {}),
        });
        id = res.data.data.id as number;
      }

      // Los archivos van después: la requisición ya existe y tiene número.
      // Si uno falla, la requisición queda y se avisa cuál no subió.
      const fallidos: string[] = [];
      for (const a of archivos) {
        const fd = new FormData();
        fd.append('archivo', a.archivo);
        fd.append('tipo', 'adjunto');
        if (a.descripcion.trim()) fd.append('descripcion', a.descripcion.trim());
        try {
          await api.post(`/requisiciones/${id}/adjuntos`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          fallidos.push(a.archivo.name);
        }
      }
      for (const adjId of quitados) {
        await api.delete(`/requisiciones/${id}/adjuntos/${adjId}`).catch(() => fallidos.push('un adjunto que se quería quitar'));
      }

      setPidiendoClave(false);
      onOpenChange(false);
      // La ventana ya se cerró: si algún archivo no subió, lo avisa la
      // pantalla de la requisición.
      onListo(id, fallidos);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; message?: string } } };
      const msg = e.response?.data?.error ?? e.response?.data?.message ?? 'No se pudo guardar la requisición';
      if (pidiendoClave || password !== undefined) {
        if (e.response?.status === 403 && /contraseña/i.test(msg)) {
          setErrorClave(msg);
          return;
        }
        setPidiendoClave(false);
      }
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  const titulo = editando ? `Editar ${requisicion!.numero}` : 'Nueva requisición';
  const nota = editando
    ? esAprobador
      ? 'Al guardar queda aprobada. Lo que cambies queda en la historia.'
      : 'Lo que cambies queda en la historia.'
    : esAprobador
      ? 'Como la apruebas tú, sale aprobada con tu contraseña.'
      : 'Al crearla pasa a aprobación.';
  const accion = editando
    ? esAprobador
      ? 'Guardar y aprobar'
      : 'Guardar cambios'
    : esAprobador
      ? 'Crear y aprobar'
      : 'Crear requisición';
  const existentes = (requisicion?.adjuntos ?? []).filter((a) => a.tipo === 'adjunto' && !quitados.includes(a.id));

  return (
    <>
      <AppDialog
        open={open}
        onOpenChange={(v) => !guardando && onOpenChange(v)}
        size="complex"
        title={titulo}
        description={proyectoNombre ?? requisicion?.proyecto_nombre ?? ''}
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-xs text-muted-foreground">{nota}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={guardando}
                className="flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
              <Button onClick={() => void guardar()} disabled={guardando} className="flex-1 sm:flex-none">
                {guardando && !pidiendoClave ? 'Guardando...' : accion}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {error && <Alert variant="error" title={error} />}

          <div>
            <Label htmlFor="req-descripcion">Descripción</Label>
            <Input
              id="req-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={300}
              className="mt-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Fecha requerida</Label>
              <DatePicker value={fecha} onChange={setFecha} className="mt-1" />
            </div>
            <div>
              <Label>Prioridad</Label>
              <RadioGroup
                value={prioridad}
                onValueChange={(v) => setPrioridad(v as Prioridad)}
                className="mt-2.5 flex items-center gap-5"
              >
                {(['normal', 'urgente'] as const).map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <RadioGroupItem value={p} id={`prioridad-${p}`} />
                    <Label htmlFor={`prioridad-${p}`} className="cursor-pointer font-normal">
                      <PrioridadEtiqueta prioridad={p} className="text-foreground" />
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Líneas</Label>
            <LineasGrid lineas={lineas} onChange={setLineas} conError={lineasMalas} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Adjuntos <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <div
                {...zona}
                className={cn(
                  'relative mt-1 overflow-hidden rounded-lg border',
                  encima ? 'border-teal ring-2 ring-teal/30' : 'border-border',
                )}
              >
                {encima && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-card/90 text-sm font-semibold text-teal">
                    Suelta los archivos para adjuntarlos
                  </div>
                )}
                {existentes.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 border-b border-slate-100 p-3">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{a.nombre_original}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="ml-auto h-7 w-7 shrink-0"
                      aria-label={`Quitar ${a.nombre_original}`}
                      onClick={() => setQuitados((q) => [...q, a.id])}
                    >
                      <X className="h-3.5 w-3.5 text-error" />
                    </Button>
                  </div>
                ))}
                {archivos.map((a, i) => (
                  <div key={`${a.archivo.name}-${i}`} className="border-b border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{a.archivo.name}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={`Quitar ${a.archivo.name}`}
                        onClick={() => setArchivos((f) => f.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5 text-error" />
                      </Button>
                    </div>
                    <Input
                      value={a.descripcion}
                      placeholder="Descripción del archivo"
                      maxLength={255}
                      onChange={(e) =>
                        setArchivos((f) => f.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))
                      }
                      className="mt-2 h-8"
                    />
                  </div>
                ))}
                <div className="bg-slate-50 p-3">
                  <button
                    type="button"
                    onClick={() => entradaArchivo.current?.click()}
                    className="flex items-center gap-2 text-sm font-semibold text-primary"
                  >
                    <Upload className="h-4 w-4" />
                    Subir archivo
                    <span className="hidden font-normal text-muted-foreground md:inline">o arrástralo aquí</span>
                  </button>
                  <input
                    ref={entradaArchivo}
                    type="file"
                    multiple
                    className="hidden"
                    accept={TIPOS_ARCHIVO.join(',')}
                    onChange={(e) => {
                      if (e.target.files) agregarArchivos(Array.from(e.target.files));
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
              {rechazados && <p className="mt-1 text-xs text-error">{rechazados}</p>}
            </div>
            <div>
              <Label htmlFor="req-notas">
                Notas <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="req-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                maxLength={5000}
                rows={5}
                className="mt-1 min-h-32"
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">
              Datos bancarios <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="req-beneficiario">Beneficiario</Label>
                <Input
                  id="req-beneficiario"
                  value={beneficiario}
                  placeholder="Nombre del beneficiario"
                  maxLength={255}
                  onChange={(e) => setBeneficiario(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="req-banco">Banco</Label>
                <Input
                  id="req-banco"
                  value={banco}
                  placeholder="Nombre del banco"
                  maxLength={255}
                  onChange={(e) => setBanco(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tipo de cuenta</Label>
                <Select value={tipoCuenta} onValueChange={setTipoCuenta}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_TIPO}>Seleccionar</SelectItem>
                    <SelectItem value="ahorro">Ahorro</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="req-cuenta">Número de cuenta</Label>
                <Input
                  id="req-cuenta"
                  value={numeroCuenta}
                  placeholder="Número de cuenta"
                  maxLength={100}
                  onChange={(e) => setNumeroCuenta(e.target.value)}
                  className="mt-1 tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>
      </AppDialog>

      <BulkApprovalPasswordDialog
        open={pidiendoClave}
        onOpenChange={(v) => !guardando && setPidiendoClave(v)}
        password={clave}
        onPasswordChange={setClave}
        pendingApprovalId={requisicion?.id ?? 0}
        reviewedCount={0}
        loading={guardando}
        error={errorClave}
        onConfirm={() => void guardar(clave)}
        description={
          editando
            ? `Ingresa tu contraseña para guardar y aprobar la requisición ${requisicion!.numero}.`
            : 'Ingresa tu contraseña para crear la requisición aprobada.'
        }
      />
    </>
  );
}
