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
import axios from 'axios';
import { Plus, X, Loader2 } from 'lucide-react';
import api from '@/services/api';
import SubidaEnCurso, { type Progreso } from './SubidaEnCurso';
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
  CLIMAS, type Area, type FilaEntrega, type Foto, type Listas, type Reporte,
  fechaCorta, hoyYMD,
} from './tipos';
import { SeccionEntregas, SeccionEquipo, SeccionPersonal } from './SeccionesFilas';
import {
  type Semilla, borrarLocal, guardarLocal, semillaDeReporte,
} from './borradorLocal';
import { useAuth } from '@/context/AuthContext';

/**
 * El tope por foto. Tiene que ser el mismo que FOTO_MB_MAX del backend
 * (routes/proyectoReportes.ts): se comprueba aqui, al elegir la foto, para que
 * el ingeniero se entere en ese momento y no despues de subir las demas.
 */
const FOTO_MB_MAX = 15;

interface Props {
  projectId: number;
  /** Si viene, se está corrigiendo; si no, es un reporte nuevo. */
  reporte?: Reporte;
  /** Un reporte nuevo que arranca con lo que quedó sin enviar. */
  semilla?: Semilla;
  /** Las fotos que ese reporte sin enviar ya tenía subidas. */
  fotosGuardadas?: Foto[];
  onListo: () => void;
  onCancelar: () => void;
  /** El codigo que le tocaria al reporte; lo pinta el titulo de la pagina. */
  onNumeroPrevisto?: (numero: string | null) => void;
}

interface FotoPendiente {
  /** Sin archivo es una foto que ya está en el servidor. */
  archivo?: File;
  url: string;
  nombre: string;
}

const megas = (bytes: number) =>
  (bytes / 1024 / 1024).toLocaleString('es-PA', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

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
  projectId, reporte, semilla, fotosGuardadas, onListo, onCancelar, onNumeroPrevisto,
}: Props) {
  const editando = !!reporte;
  const { user } = useAuth();

  // De dónde arranca: el reporte que se corrige, lo que quedó sin enviar, o
  // en blanco. Se calcula una sola vez; los estados de abajo lo toman al montar.
  const [inicial] = useState<Semilla | null>(() =>
    reporte ? semillaDeReporte(reporte, null) : semilla ?? null,
  );

  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyYMD());
  const [clima, setClima] = useState<string>(inicial?.clima ?? '');
  const [horas, setHoras] = useState(inicial?.horas ?? '');
  const [motivo, setMotivo] = useState(inicial?.motivo ?? '');
  // Las tres secciones que son filas. Las listas del proyecto se cargan de
  // /proyecto-listas; los valores son lo que se teclea hoy.
  const [listas, setListas] = useState<Listas | null>(null);
  const [personal, setPersonal] = useState<Record<number, string>>(
    inicial?.personal ?? {},
  );
  const [equiposUso, setEquiposUso] = useState<
    Record<number, { unidades: string; horas: string }>
  >(inicial?.equiposUso ?? {});
  const [entregas, setEntregas] = useState<FilaEntrega[]>(inicial?.entregas ?? []);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areasElegidas, setAreasElegidas] = useState<number[]>(
    inicial?.areasElegidas ?? [],
  );
  const [queSeHizo, setQueSeHizo] = useState(inicial?.queSeHizo ?? '');
  const [atrasos, setAtrasos] = useState(inicial?.atrasos ?? '');
  const [novedades, setNovedades] = useState(inicial?.novedades ?? '');
  // Las fotos que el reporte sin enviar ya tenía subidas entran como cualquier
  // otra, pero sin archivo y ya registradas en subidasRef: guardar() no las
  // vuelve a subir, y si el ingeniero quita una, la borra del servidor.
  const [fotos, setFotos] = useState<FotoPendiente[]>(
    () => (fotosGuardadas ?? []).map((f) => ({ url: f.url, nombre: f.nombre_archivo })),
  );
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // El progreso ya no es una frase suelta: el panel necesita saber en que
  // paso va y cuantas fotos lleva, para dibujar la lista y la barra.
  const [progreso, setProgreso] = useState<Progreso | null>(null);

  // Lo que tiene que sobrevivir a un intento fallido.
  //
  // Aqui estuvo el fallo del 2026-09-10: el id del reporte recien creado era
  // una constante dentro de guardar(), asi que al fallar la subida se perdia.
  // El ingeniero volvia a darle a Guardar y se creaba OTRO reporte. Le dio tres
  // veces.
  //
  // Van en refs y NO en estado a proposito. guardar() es un useCallback, y un
  // valor de estado que no este en su lista de dependencias se queda congelado
  // en la version memorizada de la funcion: la primera version de este arreglo
  // lo puso en estado, no lo anadio a las dependencias, y el reintento seguia
  // creando un reporte nuevo porque borradorId se leia siempre como null. El
  // arreglo era inerte y el lint solo lo decia como aviso. Una ref siempre lee
  // el valor de ahora.
  const borradorRef = useRef<number | null>(inicial?.borradorId ?? null);

  // url local de cada foto -> id que le dio el servidor.
  //
  // Un contador no sirve: entre un intento y otro el ingeniero puede quitar o
  // agregar fotos, y entonces «ya subi 3» deja de significar nada. Se subiria
  // una que quito y se perderia una que agrego, sin un solo error en pantalla.
  const subidasRef = useRef(
    new Map<string, number>((fotosGuardadas ?? []).map((f) => [f.url, f.id])),
  );
  const [error, setError] = useState<string | null>(null);
  // La conexión cortada va aparte del error: se pinta como aviso y no como
  // error, que es lo que pide FRONTEND_CONVENTIONS §15 para «no hay conexión».
  const [sinConexion, setSinConexion] = useState(false);
  const avisosRef = useRef<HTMLDivElement>(null);
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

  // Lo escrito se va guardando en el teléfono con cada cambio (borradorLocal.ts),
  // para ofrecerlo al volver si no llega a enviarse. Solo en un reporte nuevo:
  // lo que se corrige ya existe entero en el servidor.
  useEffect(() => {
    if (editando || !user) return;
    guardarLocal(user.id, projectId, {
      fecha, clima, horas, motivo, areasElegidas, queSeHizo, atrasos, novedades,
      personal, equiposUso, entregas, borradorId: borradorRef.current,
    });
  }, [
    editando, user, projectId, fecha, clima, horas, motivo, areasElegidas, queSeHizo,
    atrasos, novedades, personal, equiposUso, entregas,
  ]);

  // El aviso va arriba del formulario y el botón de guardar abajo: en un
  // reporte largo, el ingeniero que pulsa Guardar no lo veía aparecer y creía
  // que no había pasado nada. Se lleva la pantalla hasta él.
  useEffect(() => {
    if (error || sinConexion) {
      avisosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error, sinConexion]);

  // La miniatura de cada foto elegida es una url local (createObjectURL) que hay
  // que soltar cuando ya no se usa: al quitar la foto (quitarFoto) y, las que
  // queden, al salir del formulario. Nunca antes. Hasta el 2026-09-15 se
  // soltaban las de toda la lista cada vez que cambiaba: al agregar 2 fotos a 3,
  // las 3 primeras seguían en pantalla con su url ya muerta, y se veían solo
  // porque el navegador las tenía cargadas.
  //
  // La lista va en una ref porque la limpieza de un efecto sin dependencias ve
  // la lista del primer render. Las fotos sin archivo están en el servidor: esa
  // url no es nuestra.
  const fotosRef = useRef(fotos);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(
    () => () => {
      for (const f of fotosRef.current) {
        if (f.archivo) URL.revokeObjectURL(f.url);
      }
    },
    [],
  );

  const alternarArea = (id: number) =>
    setAreasElegidas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const elegirFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (guardando) return;
    const elegidas = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith('image/'),
    );
    // Las que pasan del tope no entran, y se dice cuáles y cuánto pesan. El
    // 2026-09-14 una foto de 11 MB (el tope era 10) dejó sin enviar un reporte
    // entero, y el ingeniero se enteró al final, sin saber qué foto era.
    const tope = FOTO_MB_MAX * 1024 * 1024;
    const grandes = elegidas.filter((f) => f.size > tope);
    setFotoError(
      grandes.length === 0
        ? null
        : grandes.length === 1
          ? `${grandes[0].name} pesa ${megas(grandes[0].size)} MB y no se agregó. El máximo es ${FOTO_MB_MAX} MB por foto.`
          : `No se agregaron ${grandes.length} fotos porque pasan de ${FOTO_MB_MAX} MB: ${grandes
              .map((f) => `${f.name} (${megas(f.size)} MB)`)
              .join(', ')}.`,
    );
    const nuevas = elegidas
      .filter((f) => f.size <= tope)
      .map((archivo) => ({ archivo, url: URL.createObjectURL(archivo), nombre: archivo.name }));
    setFotos((prev) => [...prev, ...nuevas]);
    e.target.value = '';
  };

  const quitarFoto = (i: number) => {
    // Mientras sube, la lista de fotos está congelada: guardar() trabaja sobre
    // la foto de la lista que tenía al empezar, así que tocarla a media subida
    // dejaría el reporte con fotos que no son las que se ven en pantalla.
    if (guardando) return;
    setFotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });
  };

  const guardar = useCallback(async () => {
    setError(null);
    setSinConexion(false);
    if (!fecha) return setError('Falta la fecha del reporte');
    if (!clima) return setError('Falta indicar el clima');
    if (!queSeHizo.trim()) return setError('Falta describir qué se hizo hoy');

    setGuardando(true);
    // La foto que está subiendo, para nombrarla si el servidor la rechaza.
    let subiendo: string | null = null;
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

      setProgreso({ paso: 'datos' });
      // Si ya hay borrador de un intento anterior se corrige, no se crea otro.
      let id = editando ? reporte!.id : borradorRef.current;
      if (id === null) {
        id = (await api.post(`/proyecto-reportes/${projectId}`, cuerpo)).data.data.id;
        borradorRef.current = id;
        // El teléfono aprende a qué borrador del servidor pertenece lo escrito:
        // así, al volver, se ofrece con las fotos que alcanzaron a subir.
        if (user) {
          guardarLocal(user.id, projectId, {
            fecha, clima, horas, motivo, areasElegidas, queSeHizo, atrasos, novedades,
            personal, equiposUso, entregas, borradorId: id,
          });
        }
      } else {
        await api.put(`/proyecto-reportes/${projectId}/${id}`, cuerpo);
      }

      // Lo que hay en pantalla manda. Si en un intento anterior llegó a subir
      // una foto que después quitó, se quita también del servidor: si no, el
      // PDF saldría con una foto que él borró a propósito.
      const enPantalla = new Set(fotos.map((f) => f.url));
      for (const [url, fotoId] of [...subidasRef.current]) {
        if (enPantalla.has(url)) continue;
        try {
          await api.delete(`/proyecto-reportes/${projectId}/${id}/fotos/${fotoId}`);
        } catch (e) {
          // Un 404 significa que ya no está, que es justo lo que se quería.
          // Sin esta tolerancia el formulario quedaba atascado para siempre:
          // el borrado llegaba al servidor, la respuesta se perdía, y cada
          // reintento volvía a pedir lo mismo y volvía a recibir 404.
          const estado = (e as { response?: { status?: number } }).response?.status;
          if (estado !== 404) throw e;
        }
        // Se olvida pase lo que pase: la foto no está en pantalla y ya no está
        // en el servidor, así que no hay nada más que hacer con ella.
        subidasRef.current.delete(url);
      }

      // Una foto por petición, no en tandas.
      //
      // Con tandas de tres, una subida cortada a medias podía dejar dos
      // guardadas en el servidor sin que el navegador se enterara, y al
      // reintentar salían repetidas en el reporte y en el PDF. De una en una,
      // cada respuesta dice exactamente cuál llegó. Y sigue cumpliendo lo que
      // buscaban las tandas: con mala señal, lo que se pierde es una foto, no
      // la subida entera.
      const pendientes = fotos.filter(
        (f): f is FotoPendiente & { archivo: File } =>
          !subidasRef.current.has(f.url) && f.archivo !== undefined,
      );
      const yaEstaban = fotos.length - pendientes.length;
      for (let i = 0; i < pendientes.length; i += 1) {
        setProgreso({ paso: 'fotos', hechas: yaEstaban + i, total: fotos.length });
        subiendo = pendientes[i].nombre;
        const datos = new FormData();
        datos.append('fotos', pendientes[i].archivo);
        // El multipart es OBLIGATORIO aquí. La instancia de api trae
        // 'application/json' por defecto, y axios, al ver un FormData con ese
        // encabezado, lo convierte a JSON en vez de mandarlo como archivo: el
        // backend no recibe nada y responde "No se recibió ninguna foto".
        // Todas las demás subidas de la app lo pasan igual.
        const r = await api.post(`/proyecto-reportes/${projectId}/${id}/fotos`, datos, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const guardada = (r.data?.data ?? [])[0];
        if (guardada?.id) subidasRef.current.set(pendientes[i].url, guardada.id);
        subiendo = null;
      }

      // Esta llamada es la que convierte el borrador en reporte: le pone
      // número y lo hace visible. Hasta aquí no existe para nadie, que es
      // justamente lo que se busca — si la subida se corta, no queda un reporte
      // a medias en la lista de nadie.
      if (!editando) {
        setProgreso({ paso: 'enviando' });
        await api.post(`/proyecto-reportes/${projectId}/${id}/emitir`);
        // Enviado: ya no hay nada que ofrecer al volver.
        if (user) borrarLocal(user.id, projectId);
      }

      borradorRef.current = null;
      subidasRef.current.clear();

      toast.success(editando ? 'Reporte corregido' : 'Reporte enviado');
      onListo();
    } catch (e) {
      // Sin respuesta del servidor quiere decir que la conexion se corto: la
      // peticion no llego, o su respuesta no volvio. Asi le paso a Ivan desde
      // el iPhone el 2026-09-14, y la pantalla solo decia «No se pudo guardar
      // el reporte», que no le dice al ingeniero ni que paso ni que hacer.
      // Cuando el servidor SI contesta, su motivo es el que vale.
      if (axios.isAxiosError(e) && !e.response) {
        setSinConexion(true);
      } else {
        const err = e as { response?: { data?: { message?: string } } };
        const motivoServidor = err.response?.data?.message ?? 'No se pudo guardar el reporte';
        setError(subiendo ? `No se pudo subir ${subiendo}: ${motivoServidor}` : motivoServidor);
      }
    } finally {
      setGuardando(false);
      setProgreso(null);
    }
  }, [
    fecha, clima, horas, motivo, listas, personal, equiposUso, entregas, areasElegidas,
    queSeHizo, atrasos, novedades, fotos, editando, reporte, projectId, onListo, user,
  ]);

  return (
    <div className="space-y-6">
      <div ref={avisosRef} className="scroll-mt-4 space-y-3 empty:hidden">
        {sinConexion && (
          <Alert
            variant="warning"
            title="Se cortó la conexión mientras se enviaba"
            description={`No se perdió nada: revisa la señal y vuelve a darle a «${editando ? 'Guardar cambios' : 'Guardar reporte'}».`}
          />
        )}
        {error && <Alert variant="error" title={error} />}
      </div>
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

        {/* En pantalla ancha van a dos columnas, igual que en el PDF: una sola
            columna a lo ancho de la tarjeta deja las casillas de número a un
            palmo de su nombre. En el teléfono se apilan. */}
        {listas && (
          <div className="border-t border-border md:grid md:grid-cols-2">
            <div className="space-y-4 p-4 md:border-r md:border-border">
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

            <div>
              <div className="space-y-4 border-t border-border p-4 md:border-t-0">
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
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border p-4">
          <SectionHeader title="Fotos" />
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="sm" disabled={guardando}>
              <label
                htmlFor="fotos"
                className={guardando ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
              >
                <Plus className="mr-2 h-4 w-4" /> Agregar fotos
              </label>
            </Button>
            <input
              id="fotos" type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              multiple className="hidden" onChange={elegirFotos} disabled={guardando}
            />
            <span className="text-sm text-muted-foreground tabular-nums">
              {fotos.length === 0
                ? 'Ninguna foto agregada'
                : `${fotos.length} ${fotos.length === 1 ? 'foto agregada' : 'fotos agregadas'}`}
            </span>
          </div>

          {fotoError && <p className="text-xs text-error">{fotoError}</p>}

          {fotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fotos.map((f, i) => (
                <div key={f.url} className="relative h-20 w-20 overflow-hidden rounded border border-border">
                  <img src={f.url} alt={f.nombre} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Quitar ${f.nombre}`}
                    onClick={() => quitarFoto(i)}
                    disabled={guardando}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-white disabled:opacity-40"
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
          vería pasar el contenido por debajo.
          El -bottom-8 y el -mb-8 hacen lo mismo con su pb-8. `sticky` se pega
          donde empieza el relleno del contenedor, no en su borde: con bottom-0
          la barra quedaba 32px por encima del borde y el formulario pasaba por
          esa franja, debajo de los botones (Ivan, 2026-09-15). -bottom-8 la
          baja hasta el borde mientras se baja, y -mb-8 la deja contra el borde
          también al llegar al final. */}
      <SubidaEnCurso progreso={progreso} fotos={fotos.length} />

      <div className="sticky -bottom-8 z-20 -mx-8 -mb-8 grid grid-cols-[1fr_2fr] gap-2 border-t border-border bg-card p-3 md:static md:mx-0 md:mb-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0">
        <Button variant="outline" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {guardando ? 'Enviando…' : editando ? 'Guardar cambios' : 'Guardar reporte'}
        </Button>
      </div>
    </div>
  );
}
