/**
 * El formulario del reporte semanal.
 *
 * Una sola página, en el mismo orden que el PDF. Lo que el ingeniero escribe se
 * va guardando solo mientras escribe —igual que el diario guarda su borrador—,
 * así que nada de lo escrito depende de acordarse de pulsar nada. En pantalla no
 * aparece la palabra «guardado»: el botón de abajo es el que ENVÍA el reporte.
 *
 * Lo que no se edita aquí son los números de la semana: salen de los reportes
 * diarios (SeccionDatos).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, X } from 'lucide-react';
import api from '@/services/api';
import { Alert, SectionHeader } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import SeccionDatos from './SeccionDatos';
import SeccionFotos from './SeccionFotos';
import { MetasDeLaSemana, MetasDelPlan } from './SeccionMetas';
import { semanaLarga } from './fechas';
import {
  INICIALES_DIA, diaCorto, type Decision, type Meta, type MetaPlan, type Problema,
  type SemanaDisponible, type SemanalDetalle,
} from './tipos';

interface Props {
  projectId: number;
  reporteId: number;
  /** Cambiar de semana abre (o sigue) el reporte de esa otra semana. */
  onCambiarReporte: (id: number) => void;
  onListo: () => void;
  onCancelar: () => void;
  onCabecera?: (titulo: string | null) => void;
}

/** Un textarea que crece con lo que se escribe, igual que en el reporte diario. */
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

export default function SemanalForm({
  projectId, reporteId, onCambiarReporte, onListo, onCancelar, onCabecera,
}: Props) {
  const [detalle, setDetalle] = useState<SemanalDetalle | null>(null);
  const [semanas, setSemanas] = useState<SemanaDisponible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Lo que se escribe.
  const [resumen, setResumen] = useState('');
  const [loQueSeEspera, setLoQueSeEspera] = useState('');
  const [metas, setMetas] = useState<Meta[]>([]);
  const [metasPlan, setMetasPlan] = useState<MetaPlan[]>([]);
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [decisiones, setDecisiones] = useState<Decision[]>([]);
  const [fotos, setFotos] = useState<number[]>([]);

  // Lo último que el servidor ya tiene, para no mandar lo mismo dos veces.
  const guardadoRef = useRef<string>('');

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    api
      .get(`/proyecto-reportes-semanales/${projectId}/${reporteId}`)
      .then((r) => {
        const d = r.data.data as SemanalDetalle;
        setDetalle(d);
        setResumen(d.resumen ?? '');
        setLoQueSeEspera(d.lo_que_se_espera ?? '');
        setMetas(d.metas);
        setMetasPlan(d.metas_plan);
        setProblemas(d.problemas);
        setDecisiones(d.decisiones);
        setFotos(d.fotos_elegidas);
        guardadoRef.current = '';
      })
      .catch(() => setError('No se pudo abrir el reporte'))
      .finally(() => setCargando(false));
  }, [projectId, reporteId]);

  useEffect(cargar, [cargar]);

  useEffect(() => {
    api
      .get(`/proyecto-reportes-semanales/${projectId}/semanas`)
      .then((r) => setSemanas(r.data.data ?? []))
      .catch(() => setSemanas([]));
  }, [projectId, reporteId]);

  useEffect(() => {
    onCabecera?.(detalle ? `Semana ${detalle.semana_iso} · ${semanaLarga(detalle.semana_inicio, detalle.semana_fin)}` : null);
  }, [detalle, onCabecera]);

  /** Lo escrito, tal como viaja al servidor. */
  const cuerpo = useCallback(() => ({
    resumen,
    lo_que_se_espera: loQueSeEspera,
    metas_evaluadas: metas.map((m) => ({
      id: m.id,
      fuera_del_plan: m.fuera_del_plan ?? false,
      texto: m.texto,
      cantidad: m.cantidad,
      unidad: m.unidad,
      estado: m.estado,
      cantidad_hecha: m.cantidad_hecha,
      porcentaje: m.porcentaje,
      motivo: m.motivo,
    })),
    metas_plan: metasPlan.map((m) => ({
      texto: m.texto, cantidad: m.cantidad, unidad: m.unidad,
    })),
    problemas: problemas.map((p) => ({
      fecha: p.fecha, problema: p.problema, accion: p.accion,
    })),
    decisiones: decisiones.map((d) => ({ texto: d.texto })),
    fotos,
  }), [resumen, loQueSeEspera, metas, metasPlan, problemas, decisiones, fotos]);

  /** Guarda lo escrito. Devuelve false si no llegó. */
  const guardar = useCallback(async (): Promise<boolean> => {
    if (!detalle || detalle.completo) return true;
    const datos = cuerpo();
    const firma = JSON.stringify(datos);
    if (firma === guardadoRef.current) return true;
    try {
      await api.put(`/proyecto-reportes-semanales/${projectId}/${detalle.id}`, datos);
      guardadoRef.current = firma;
      setSinConexion(false);
      return true;
    } catch (e) {
      // Sin respuesta del servidor es la conexión, no un error del reporte:
      // se avisa sin alarmar y lo escrito sigue en pantalla.
      if (axios.isAxiosError(e) && !e.response) setSinConexion(true);
      else setError('No se pudo guardar lo escrito');
      return false;
    }
  }, [cuerpo, detalle, projectId]);

  // Se guarda solo, poco después de dejar de escribir.
  useEffect(() => {
    if (!detalle || detalle.completo || cargando) return;
    const t = setTimeout(() => { void guardar(); }, 1200);
    return () => clearTimeout(t);
  }, [guardar, detalle, cargando]);

  const enviar = async () => {
    if (!detalle) return;
    if (!resumen.trim()) {
      setError('Falta el resumen de la semana');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const llego = await guardar();
      if (!llego) return;
      await api.post(`/proyecto-reportes-semanales/${projectId}/${detalle.id}/emitir`);
      toast.success('Reporte semanal enviado');
      onListo();
    } catch (e) {
      if (axios.isAxiosError(e) && !e.response) setSinConexion(true);
      else {
        const msg = (e as { response?: { data?: { message?: string } } })
          .response?.data?.message;
        setError(msg ?? 'No se pudo enviar el reporte');
      }
    } finally {
      setEnviando(false);
    }
  };

  const cambiarSemana = async (inicio: string) => {
    if (!detalle || inicio === detalle.semana_inicio) return;
    await guardar();
    try {
      const r = await api.post(`/proyecto-reportes-semanales/${projectId}`, { fecha: inicio });
      onCambiarReporte(r.data.data.id as number);
    } catch {
      setError('No se pudo abrir esa semana');
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Abriendo el reporte…
      </div>
    );
  }
  if (!detalle) {
    return <Alert variant="error" title={error ?? 'No se pudo abrir el reporte'} />;
  }

  const dias = detalle.datos.dias;
  const opciones = semanas.some((s) => s.semana_inicio === detalle.semana_inicio)
    ? semanas
    : [
      {
        semana_inicio: detalle.semana_inicio,
        semana_fin: detalle.semana_fin,
        anio_iso: detalle.anio_iso,
        semana_iso: detalle.semana_iso,
        diarios: dias.filter((d) => d.numero !== null).length,
        borrador_id: detalle.id,
      },
      ...semanas,
    ];

  return (
    <div className="space-y-6">
      <div className="space-y-3 empty:hidden">
        {sinConexion && (
          <Alert
            variant="warning"
            title="Se cortó la conexión"
            description="No se perdió nada de lo que escribiste: revisa la señal y sigue."
          />
        )}
        {error && <Alert variant="error" title={error} />}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="space-y-4 p-4">
          <SectionHeader title="Semana" />
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Select value={detalle.semana_inicio} onValueChange={cambiarSemana}>
              <SelectTrigger className="w-full md:w-[24rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opciones.map((s) => (
                  <SelectItem key={s.semana_inicio} value={s.semana_inicio}>
                    Semana {s.semana_iso} · {semanaLarga(s.semana_inicio, s.semana_fin)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Los siete días, con marca en los que tienen reporte diario. El
                domingo se queda en blanco salvo que alguien reportara ese día. */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {dias.map((d, i) => (
                  <span key={d.fecha} className="flex flex-col items-center gap-1" title={diaCorto(d.fecha)}>
                    <span
                      className={`h-4 w-4 rounded border ${
                        d.numero ? 'border-navy bg-navy' : 'border-border bg-card'
                      }`}
                    />
                    <span className="text-[10px] leading-none text-muted-foreground">
                      {INICIALES_DIA[i]}
                    </span>
                  </span>
                ))}
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">
                {dias.filter((d) => d.numero !== null).length} reportes diarios ·{' '}
                {detalle.fotos.length} fotos
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader title="Resumen de la semana" />
          <TextareaCrece
            id="resumen"
            rows={7}
            value={resumen}
            onChange={setResumen}
            placeholder="Cómo fue la semana: lo que se avanzó, lo que se atrasó y por qué."
          />
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader title="Datos de la semana" />
          <SeccionDatos datos={detalle.datos} />
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader
            title="Metas de la semana"
            count={metas.filter((m) => m.estado !== null).length}
          />
          <MetasDeLaSemana metas={metas} onCambio={setMetas} />
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader title="Problemas y atrasos" />
          <div className="space-y-3">
            <div className="hidden gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[7rem_1fr_1fr_2rem]">
              <span>Día</span><span>Problema</span><span>Acción a tomar</span><span />
            </div>
            {problemas.map((p, i) => {
              const cambiar = (c: Partial<Problema>) =>
                setProblemas(problemas.map((x, j) => (j === i ? { ...x, ...c } : x)));
              return (
                <div
                  key={p.id ?? `nuevo-${i}`}
                  className="grid grid-cols-[1fr_2rem] gap-3 md:grid-cols-[7rem_1fr_1fr_2rem]"
                >
                  <Select
                    value={p.fecha ?? 'semana'}
                    onValueChange={(v) => cambiar({ fecha: v === 'semana' ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semana">Toda la semana</SelectItem>
                      {dias.map((d) => (
                        <SelectItem key={d.fecha} value={d.fecha}>{diaCorto(d.fecha)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-8 text-muted-foreground md:order-last"
                    aria-label="Quitar el problema"
                    onClick={() => setProblemas(problemas.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="col-span-2 space-y-1.5 md:col-span-1">
                    <Label className="md:hidden" htmlFor={`prob-${i}`}>Problema</Label>
                    <TextareaCrece
                      id={`prob-${i}`}
                      rows={2}
                      value={p.problema}
                      onChange={(v) => cambiar({ problema: v })}
                      placeholder="Qué pasó"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5 md:col-span-1">
                    <Label className="md:hidden" htmlFor={`acc-${i}`}>Acción a tomar</Label>
                    <TextareaCrece
                      id={`acc-${i}`}
                      rows={2}
                      value={p.accion ?? ''}
                      onChange={(v) => cambiar({ accion: v })}
                      placeholder="Qué se va a hacer"
                    />
                  </div>
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProblemas([...problemas, { fecha: null, problema: '', accion: '' }])}
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar problema
            </Button>
          </div>
        </div>

        <div className="space-y-4 border-t border-border p-4">
          <SectionHeader title="Plan de la próxima semana" />
          <div className="space-y-1.5">
            <Label htmlFor="espera">Lo que se espera</Label>
            <TextareaCrece
              id="espera"
              value={loQueSeEspera}
              onChange={setLoQueSeEspera}
              placeholder="En qué va a estar la obra la semana que viene."
            />
          </div>
          <MetasDelPlan metas={metasPlan} onCambio={setMetasPlan} />
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader title="Decisiones que se necesitan" />
          <div className="space-y-3">
            {decisiones.map((d, i) => (
              <div key={d.id ?? `nueva-${i}`} className="flex items-center gap-2">
                <Input
                  value={d.texto}
                  placeholder="Qué hay que decidir en la oficina"
                  onChange={(e) => setDecisiones(
                    decisiones.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)),
                  )}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-8 flex-none text-muted-foreground"
                  aria-label="Quitar la decisión"
                  onClick={() => setDecisiones(decisiones.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDecisiones([...decisiones, { texto: '' }])}
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar decisión
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader title="Fotos" count={fotos.length} />
          <SeccionFotos fotos={detalle.fotos} elegidas={fotos} onCambio={setFotos} />
        </div>
      </div>

      <div className="sticky -bottom-8 z-20 -mx-8 -mb-8 grid grid-cols-[1fr_2fr] gap-2 border-t border-border bg-card p-3 md:static md:mx-0 md:mb-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0">
        <Button variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button onClick={enviar} disabled={enviando}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {enviando ? 'Enviando…' : 'Guardar reporte'}
        </Button>
      </div>
    </div>
  );
}
