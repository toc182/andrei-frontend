/**
 * Formulario del reporte diario.
 *
 * Una sola página, sin pasos. Las decisiones de distribución salieron de
 * probar el diseño en un teléfono de verdad y no son cosméticas:
 *
 * - En escritorio fecha, clima, horas y motivo van en una fila. En móvil,
 *   fecha y clima arriba y horas (angosto) junto a motivo debajo.
 * - Los campos se alinean por abajo, para que una etiqueta que se parte en
 *   dos líneas no deje su casilla a distinta altura que la de al lado.
 * - Las áreas son fichas, no una lista de casillas: ocupan mucho menos.
 * - Los campos de texto crecen hacia abajo mientras se escribe.
 * - En móvil el botón de guardar se queda abajo mientras haya formulario. Es
 *   `sticky`, no `fixed`: en Safari de iPhone una barra `fixed` se ancla a una
 *   ventana que sigue por debajo de la barra del navegador, tapa contenido y
 *   salta cuando Safari esconde su barra al bajar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { Alert, DatePicker, SectionHeader } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CLIMAS, type Area, type FilaEntrega, type Listas, type Reporte,
  fechaCorta, hoyYMD,
} from './tipos';
import { SeccionEntregas, SeccionEquipo, SeccionPersonal } from './SeccionesFilas';

interface Props {
  projectId: number;
  /** Si viene, se está corrigiendo; si no, es un reporte nuevo. */
  reporte?: Reporte;
  onListo: () => void;
  onCancelar: () => void;
  /** El codigo que le tocaria al reporte; lo pinta el titulo de la pagina. */
  onNumeroPrevisto?: (numero: string | null) => void;
}

interface FotoPendiente {
  archivo: File;
  url: string;
}

/** Un textarea que crece con lo que se escribe. */
function TextareaCrece({
  id, value, onChange, placeholder, rows = 3,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <Textarea
      id={id}
      ref={ref}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="resize-none overflow-hidden"
    />
  );
}

export default function ReporteForm({
  projectId, reporte, onListo, onCancelar, onNumeroPrevisto,
}: Props) {
  const editando = !!reporte;

  const [fecha, setFecha] = useState(reporte?.fecha.slice(0, 10) ?? hoyYMD());
  const [clima, setClima] = useState<string>(reporte?.clima ?? '');
  const [horas, setHoras] = useState(reporte?.horas_perdidas ?? '');
  const [motivo, setMotivo] = useState(reporte?.motivo ?? '');
  // Las tres secciones que son filas. Las listas del proyecto se cargan de
  // /proyecto-listas; los valores son lo que se teclea hoy.
  const [listas, setListas] = useState<Listas | null>(null);
  const [personal, setPersonal] = useState<Record<number, string>>(
    () => Object.fromEntries(
      (reporte?.personal ?? []).map((f) => [f.puesto_id, String(f.cantidad)]),
    ),
  );
  const [equiposUso, setEquiposUso] = useState<
    Record<number, { unidades: string; horas: string }>
  >(
    () => Object.fromEntries(
      (reporte?.equipos ?? []).map((f) => [
        f.equipo_id,
        { unidades: String(f.unidades), horas: String(f.horas) },
      ]),
    ),
  );
  const [entregas, setEntregas] = useState<FilaEntrega[]>(
    () => (reporte?.entregas ?? []).map((f) => ({
      categoria_id: f.categoria_id,
      descripcion: f.descripcion,
      cantidad: f.cantidad ?? '',
      unidad: f.unidad ?? '',
      notas: f.notas ?? '',
    })),
  );
  const [areas, setAreas] = useState<Area[]>([]);
  const [areasElegidas, setAreasElegidas] = useState<number[]>(
    reporte?.areas.map((a) => a.id) ?? [],
  );
  const [queSeHizo, setQueSeHizo] = useState(reporte?.que_se_hizo ?? '');
  const [atrasos, setAtrasos] = useState(reporte?.atrasos ?? '');
  const [novedades, setNovedades] = useState(reporte?.novedades ?? '');
  const [fotos, setFotos] = useState<FotoPendiente[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [yaReportado, setYaReportado] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/proyecto-areas/${projectId}`)
      .then((r) => setAreas(r.data.data ?? []))
      .catch(() => setAreas([]));
  }, [projectId]);

  // Las cuatro listas vienen de un solo viaje: el formulario las necesita
  // todas y se llena en obra, donde cada petición de más es otra manera de
  // fallar.
  const cargarListas = useCallback(() => {
    api
      .get(`/proyecto-listas/${projectId}`)
      .then((r) => setListas(r.data.data))
      .catch(() => setListas(null));
  }, [projectId]);

  useEffect(cargarListas, [cargarListas]);

  // Las listas son del proyecto, no del día: se guardan en cuanto se tocan,
  // igual que las áreas, y no esperan a que se guarde el reporte.
  const tocarLista = useCallback(
    async (peticion: Promise<unknown>) => {
      try {
        await peticion;
        cargarListas();
      } catch (e) {
        const msg = (e as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        setError(msg ?? 'No se pudo actualizar la lista');
      }
    },
    [cargarListas],
  );

  const agregarA = (lista: string, nombre: string, empresaId?: number | null) =>
    tocarLista(api.post(`/proyecto-listas/${projectId}/${lista}`, {
      nombre, empresa_id: empresaId ?? null,
    }));

  const quitarDe = (lista: string, id: number) =>
    tocarLista(api.delete(`/proyecto-listas/${projectId}/${lista}/${id}`));

  // Dos cosas de una: el codigo que le tocaria al reporte, y el aviso suave
  // de fecha repetida. El aviso nunca bloquea — a proposito no hay limite de
  // un reporte por dia, porque alguien tiene que poder cubrir a quien esta
  // de vacaciones.
  useEffect(() => {
    if (editando || !fecha) {
      setYaReportado(null);
      onNumeroPrevisto?.(null);
      return;
    }
    let vigente = true;
    api
      .get(`/proyecto-reportes/${projectId}/existe`, { params: { fecha } })
      .then((r) => {
        if (!vigente) return;
        setYaReportado(r.data.data?.ya_reportado ? fechaCorta(fecha) : null);
        onNumeroPrevisto?.(r.data.data?.numero_siguiente ?? null);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [projectId, fecha, editando, onNumeroPrevisto]);

  useEffect(
    () => () => fotos.forEach((f) => URL.revokeObjectURL(f.url)),
    [fotos],
  );

  const alternarArea = (id: number) =>
    setAreasElegidas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const elegirFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevas = Array.from(e.target.files ?? [])
      .filter((f) => f.type.startsWith('image/'))
      .map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) }));
    setFotos((prev) => [...prev, ...nuevas]);
    e.target.value = '';
  };

  const quitarFoto = (i: number) =>
    setFotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });

  const guardar = useCallback(async () => {
    setError(null);
    if (!fecha) return setError('Falta la fecha del reporte');
    if (!clima) return setError('Falta indicar el clima');
    if (!queSeHizo.trim()) return setError('Falta describir qué se hizo hoy');

    setGuardando(true);
    try {
      const cuerpo = {
        fecha,
        clima,
        horas_perdidas: horas === '' ? null : Number(horas),
        motivo: motivo.trim() || null,
        areas: areasElegidas,
        que_se_hizo: queSeHizo.trim(),
        atrasos: atrasos.trim() || null,
        novedades: novedades.trim() || null,
        // Se mandan todas las filas, incluidas las que quedaron en cero: el
        // servidor descarta los ceros, y mandarlas es lo que le dice que la
        // sección sí se está tocando. Omitirlas significaría "no tocar".
        personal: (listas?.puestos ?? []).map((p) => ({
          puesto_id: p.id,
          cantidad: Number(personal[p.id] || 0),
        })),
        equipos: (listas?.equipos ?? []).map((q) => ({
          equipo_id: q.id,
          unidades: Number(equiposUso[q.id]?.unidades || 0),
          horas: Number(equiposUso[q.id]?.horas || 0),
        })),
        entregas: entregas.map((f) => ({
          categoria_id: f.categoria_id,
          descripcion: f.descripcion,
          cantidad: f.cantidad === '' ? null : Number(f.cantidad),
          unidad: f.unidad,
          notas: f.notas,
        })),
      };

      setProgreso('Guardando el reporte…');
      const id = editando
        ? reporte!.id
        : (await api.post(`/proyecto-reportes/${projectId}`, cuerpo)).data.data.id;
      if (editando) await api.put(`/proyecto-reportes/${projectId}/${id}`, cuerpo);

      // Las fotos van en tandas pequeñas y no en una sola subida gigante:
      // en obra con mala señal, perder una tanda no obliga a repetir todo.
      for (let i = 0; i < fotos.length; i += 3) {
        const tanda = fotos.slice(i, i + 3);
        setProgreso(
          `Subiendo fotos… ${Math.min(i + tanda.length, fotos.length)} de ${fotos.length}`,
        );
        const datos = new FormData();
        tanda.forEach((f) => datos.append('fotos', f.archivo));
        // El multipart es OBLIGATORIO aquí. La instancia de api trae
        // 'application/json' por defecto, y axios, al ver un FormData con ese
        // encabezado, lo convierte a JSON en vez de mandarlo como archivo: el
        // backend no recibe nada y responde "No se recibió ninguna foto".
        // Todas las demás subidas de la app lo pasan igual.
        await api.post(`/proyecto-reportes/${projectId}/${id}/fotos`, datos, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // El correo sale al final, cuando el reporte ya está completo. Si se
      // mandara al guardar, saldría sin fotos, que es justo lo que no podía
      // hacer el formulario de Google.
      if (!editando) {
        setProgreso('Enviando el reporte…');
        await api.post(`/proyecto-reportes/${projectId}/${id}/emitir`);
      }

      toast.success(editando ? 'Reporte corregido' : 'Reporte enviado');
      onListo();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'No se pudo guardar el reporte');
    } finally {
      setGuardando(false);
      setProgreso('');
    }
  }, [
    fecha, clima, horas, motivo, listas, personal, equiposUso, entregas, areasElegidas,
    queSeHizo, atrasos, novedades, fotos, editando, reporte, projectId, onListo,
  ]);

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" title={error} />}
      {yaReportado && (
        <Alert
          variant="warning"
          title={`Ya mandaste un reporte del ${yaReportado}`}
          description="Puedes seguir: si estás cubriendo a alguien o es un segundo turno, el reporte se guarda igual."
        />
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="space-y-4 p-4">
          <SectionHeader title="Del día" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[9rem_12rem_7rem_1fr]">
            <div className="col-span-1 flex flex-col justify-end gap-1.5">
              <Label htmlFor="fecha">Fecha *</Label>
              <DatePicker value={fecha} onChange={setFecha} />
            </div>
            <div className="col-span-1 flex flex-col justify-end gap-1.5">
              <Label htmlFor="clima">Clima *</Label>
              <Select value={clima} onValueChange={setClima}>
                <SelectTrigger id="clima">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {CLIMAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end gap-1.5">
              <Label htmlFor="horas">Horas perdidas</Label>
              <Input
                id="horas" type="number" inputMode="decimal"
                min="0" max="24" step="0.5" placeholder="0"
                value={horas} onChange={(e) => setHoras(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="flex flex-col justify-end gap-1.5">
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo" value={motivo} placeholder="Lluvia desde las 2pm…"
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-border p-4">
          <SectionHeader title="Trabajo ejecutado" />

          <div className="space-y-2">
            <Label>Áreas de trabajo</Label>
            {areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este proyecto todavía no tiene áreas definidas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {areas.map((a) => {
                  const activa = areasElegidas.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => alternarArea(a.id)}
                      aria-pressed={activa}
                      className={
                        'rounded-full border px-3 py-1 text-sm font-medium transition-colors ' +
                        (activa
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-slate-700 hover:border-primary')
                      }
                    >
                      {a.nombre}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="que">Trabajo ejecutado *</Label>
            <TextareaCrece
              id="que" value={queSeHizo} onChange={setQueSeHizo}
              placeholder="Vaciado de losa en área de chorros, armado de acero en torre péndulo…"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="atrasos">Atrasos o impedimentos</Label>
              <TextareaCrece
                id="atrasos" rows={2} value={atrasos} onChange={setAtrasos}
                placeholder="Falta de material, equipo dañado…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="novedades">Novedades del día</Label>
              <TextareaCrece
                id="novedades" rows={2} value={novedades} onChange={setNovedades}
                placeholder="Visitas, instrucciones, incidentes"
              />
            </div>
          </div>
        </div>

        {/* Personal, Equipo y Entregas. Las listas del proyecto salen solas;
            lo que se teclea aquí son los números de hoy. */}
        {listas && (
          <>
            <div className="space-y-4 border-t border-border p-4">
              <SectionHeader title="Personal" />
              <SeccionPersonal
                listas={listas}
                valores={personal}
                onCantidad={(id, v) => setPersonal((p) => ({ ...p, [id]: v }))}
                onAgregarPuesto={(nombre, empresaId) => agregarA('puestos', nombre, empresaId)}
                onQuitarPuesto={(id) => quitarDe('puestos', id)}
                onAgregarEmpresa={(nombre) => agregarA('empresas', nombre)}
                onQuitarEmpresa={(id) => quitarDe('empresas', id)}
              />
            </div>

            <div className="space-y-4 border-t border-border p-4">
              <SectionHeader title="Equipo" />
              <SeccionEquipo
                listas={listas}
                valores={equiposUso}
                onValor={(id, campo, v) => setEquiposUso((q) => ({
                  ...q,
                  [id]: { unidades: '', horas: '', ...q[id], [campo]: v },
                }))}
                onAgregar={(nombre) => agregarA('equipos', nombre)}
                onQuitar={(id) => quitarDe('equipos', id)}
              />
            </div>

            <div className="space-y-4 border-t border-border p-4">
              <SectionHeader title="Entregas" />
              <SeccionEntregas
                listas={listas}
                filas={entregas}
                onFilas={setEntregas}
                onAgregarCategoria={(nombre) => agregarA('categorias', nombre)}
              />
            </div>
          </>
        )}

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader title="Fotos" />
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <label htmlFor="fotos" className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" /> Agregar fotos
              </label>
            </Button>
            <input
              id="fotos" type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              multiple className="hidden" onChange={elegirFotos}
            />
            <span className="text-sm text-muted-foreground tabular-nums">
              {fotos.length === 0
                ? 'Ninguna foto agregada'
                : `${fotos.length} ${fotos.length === 1 ? 'foto agregada' : 'fotos agregadas'}`}
            </span>
          </div>

          {fotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fotos.map((f, i) => (
                <div key={f.url} className="relative h-20 w-20 overflow-hidden rounded border border-border">
                  <img src={f.url} alt={f.archivo.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Quitar ${f.archivo.name}`}
                    onClick={() => quitarFoto(i)}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded border-l-[3px] border-l-warning bg-warning/5 px-3 py-2 text-xs leading-relaxed text-slate-700">
            <b className="text-warning">Recuerda:</b> es obligatorio fotografiar el acero
            armado antes de vaciar, y la tubería antes de rellenar.
          </div>

          {editando && (
            <p className="text-xs text-muted-foreground">
              Las fotos que agregues aquí se suman a las que el reporte ya tiene.
            </p>
          )}
        </div>
      </div>

      {/* En móvil los botones se quedan abajo mientras haya formulario, para no
          tener que bajar hasta el final cada vez que se quiere guardar.
          Es `sticky` y no `fixed`: en Safari de iPhone una barra `fixed` se
          ancla a una ventana que sigue por debajo de la barra del navegador, y
          entonces tapa contenido, se monta sobre la barra de Safari y todo
          salta cuando Safari la esconde al bajar. En `sticky` la barra ocupa su
          lugar real en la página y deja de pelear con el navegador — por eso
          tampoco hace falta ya el relleno inferior que la compensaba.
          El -mx-8 la hace sangrar hasta los bordes: el contenedor con scroll
          de AppLayout lleva px-8, y sin eso quedarían dos franjas por donde se
          vería pasar el contenido por debajo. */}
      <div className="sticky bottom-0 z-20 -mx-8 grid grid-cols-[1fr_2fr] gap-2 border-t border-border bg-card p-3 md:static md:mx-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0">
        <Button variant="outline" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {guardando ? progreso || 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar reporte'}
        </Button>
      </div>
    </div>
  );
}
