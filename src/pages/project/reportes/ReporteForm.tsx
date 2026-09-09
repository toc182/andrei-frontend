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
 * - En móvil el botón de guardar queda fijo abajo, con el espacio inferior
 *   suficiente para no tapar la última sección.
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
  CLIMAS, type Area, type Reporte, fechaCorta, hoyYMD,
} from './tipos';

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
  const [calificado, setCalificado] = useState(
    reporte ? String(reporte.personal_calificado) : '',
  );
  const [ayudantes, setAyudantes] = useState(
    reporte ? String(reporte.ayudantes) : '',
  );
  const [equipo, setEquipo] = useState<string[]>(reporte?.equipo ?? []);
  const [agregandoEquipo, setAgregandoEquipo] = useState(false);
  const [equipoNuevo, setEquipoNuevo] = useState('');
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
  const [sugerencias, setSugerencias] = useState<string[]>([]);

  useEffect(() => {
    api
      .get(`/proyecto-areas/${projectId}`)
      .then((r) => setAreas(r.data.data ?? []))
      .catch(() => setAreas([]));
  }, [projectId]);

  // Las sugerencias de equipo son lo que ya se escribió en este proyecto:
  // la lista se va armando sola.
  useEffect(() => {
    api
      .get(`/proyecto-reportes/${projectId}`, { params: { limit: 60 } })
      .then((r) => {
        const vistos = new Set<string>();
        for (const fila of (r.data.data ?? []) as { equipo: string[] }[]) {
          for (const e of fila.equipo ?? []) vistos.add(e);
        }
        setSugerencias([...vistos].sort());
      })
      .catch(() => setSugerencias([]));
  }, [projectId]);

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

  const agregarEquipo = () => {
    const nombre = equipoNuevo.trim();
    if (nombre && !equipo.includes(nombre)) setEquipo([...equipo, nombre]);
    setEquipoNuevo('');
    setAgregandoEquipo(false);
  };

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
        personal_calificado: Number(calificado || 0),
        ayudantes: Number(ayudantes || 0),
        equipo,
        areas: areasElegidas,
        que_se_hizo: queSeHizo.trim(),
        atrasos: atrasos.trim() || null,
        novedades: novedades.trim() || null,
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
        await api.post(`/proyecto-reportes/${projectId}/${id}/fotos`, datos);
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
    fecha, clima, horas, motivo, calificado, ayudantes, equipo, areasElegidas,
    queSeHizo, atrasos, novedades, fotos, editando, reporte, projectId, onListo,
  ]);

  return (
    <div className="space-y-6 pb-28 md:pb-0">
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
          <SectionHeader title="Personal y equipo" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[8rem_8rem_1fr]">
            <div className="flex flex-col justify-end gap-1.5">
              <Label htmlFor="calificado">Personal calificado</Label>
              <Input
                id="calificado" type="number" inputMode="numeric" min="0" placeholder="0"
                value={calificado} onChange={(e) => setCalificado(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="flex flex-col justify-end gap-1.5">
              <Label htmlFor="ayudantes">Ayudantes</Label>
              <Input
                id="ayudantes" type="number" inputMode="numeric" min="0" placeholder="0"
                value={ayudantes} onChange={(e) => setAyudantes(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Equipo que se utilizó</Label>
            <div className="flex flex-wrap gap-2">
              {equipo.map((e) => (
                <span
                  key={e}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-slate-700"
                >
                  {e}
                  <button
                    type="button"
                    aria-label={`Quitar ${e}`}
                    onClick={() => setEquipo(equipo.filter((x) => x !== e))}
                    className="text-muted-foreground hover:text-error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            {agregandoEquipo ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  list="equipo-sugerencias"
                  value={equipoNuevo}
                  placeholder="Escoger o escribir…"
                  onChange={(e) => setEquipoNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); agregarEquipo(); }
                    if (e.key === 'Escape') { setEquipoNuevo(''); setAgregandoEquipo(false); }
                  }}
                />
                <datalist id="equipo-sugerencias">
                  {sugerencias.map((s) => <option key={s} value={s} />)}
                </datalist>
                <Button type="button" onClick={agregarEquipo}>Agregar</Button>
              </div>
            ) : (
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setAgregandoEquipo(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Agregar equipo
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4 border-t border-border p-4">
          <SectionHeader title="Trabajo ejecutado" />

          <div className="space-y-2">
            <Label>Áreas donde se trabajó hoy</Label>
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
            <Label htmlFor="que">¿Qué se hizo hoy? *</Label>
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
                placeholder="Visitas, instrucciones, entregas, incidentes"
              />
            </div>
          </div>
        </div>

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

      {/* En móvil los botones quedan fijos abajo, para no tener que bajar
          hasta el final del formulario cada vez que se quiere guardar. */}
      <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-[1fr_2fr] gap-2 border-t border-border bg-card p-3 md:static md:flex md:justify-end md:border-0 md:bg-transparent md:p-0">
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
