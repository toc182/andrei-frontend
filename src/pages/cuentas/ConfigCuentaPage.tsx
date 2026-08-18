// src/pages/cuentas/ConfigCuentaPage.tsx — Configurar Cuenta: el montaje de la
// hoja que se imprime y se entrega en la institución (Cuadro de Presentación
// de Cuenta).
//
// Lo que se llena aquí se llena UNA vez y vale para todas las cuentas del
// proyecto: el título, las etiquetas de las tres columnas del encabezado, los
// valores que no cambian de una cuenta a otra, las firmas y los logos. Por eso
// vive en la página de Cuentas del proyecto y no dentro de una cuenta.
//
// Lo que el sistema ya sabe NO se escribe: esas líneas aparecen marcadas
// `auto` y su valor se recalcula del cuadro cada vez que se abre la hoja.
// Guardarlos a mano es lo que hizo que la Cuenta 2 se entregara diciendo
// 36.54% de avance del periodo cuando el pie de su propia tabla decía 12.81%.
//
// El papel no se elige: la hoja va siempre en legal horizontal.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Maximize2, Plus, RotateCcw, Trash2, Undo2, X } from 'lucide-react';
import { AppDialog, PageHeader, ErrorState, TableSkeleton } from '@/components/shell';
import { Alert } from '@/components/shell/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PRINT_PAPERS } from '@/lib/cronogramaPrint';
import { buildCuadroPrintPages, MAX_TITULO_LINEAS } from '@/lib/cuadroPrint';
import { resolveLogoSide } from '@/lib/printLogos';
import { calcTotales, type CuadroLinea } from '@/lib/cuadroModel';
import { getDesglose } from '@/lib/desgloseApi';
import {
  ajustesPorDefecto, aOpcionesImpresion, autoFaltantes, normalizarAjustes, valorDe,
  COLUMNA_TITULOS, MAX_FIRMAS, PAPEL_HOJA, mover,
  type AjustesImpresion, type CtxImpresion, type FirmaImpresion, type LineaImpresion,
  type RenglonTitulo,
} from '@/lib/cuentaImpresion';
import {
  getCuadro, getProyectoImpresion, guardarAjustesImpresion,
} from '@/lib/cuadroApi';
import {
  campoPlano, CampoOrdenable, ChipAuto, EditorColor, EditorFirmas, EditorLogos, EstadoGuardado,
  FilaAuto, Titulo,
  type Guardado,
} from './impresionPiezas';

interface Props {
  projectId: number;
  /** Cuenta con la que se dibuja el ejemplo de la hoja; sin ella solo se ve el
   *  panel, porque no hay cuadro del que sacar la tabla. */
  ejemploCuentaId?: number;
  onBack: () => void;
}

/** Lo cargado del servidor: el contexto con el que se resuelven las líneas
 *  automáticas y, si hay cuenta de ejemplo, sus filas para dibujar la hoja. */
interface Base {
  ctx: CtxImpresion;
  lineas: CuadroLinea[];
  ajustesRaw: unknown | null;
  ejemploNumero: number | null;
}

export default function ConfigCuentaPage({ projectId, ejemploCuentaId, onBack }: Props) {
  const [base, setBase] = useState<Base | null>(null);
  const [ajustes, setAjustes] = useState<AjustesImpresion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [guardado, setGuardado] = useState<Guardado>('limpio');
  const [aviso, setAviso] = useState<string | null>(null);
  const [paginas, setPaginas] = useState<{ svgs: string[]; err: string | null } | null>(null);
  /** La hoja de ejemplo abierta a tamaño grande. Solo se mira; no se guarda. */
  const [expandido, setExpandido] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (ejemploCuentaId) {
        // Una sola llamada trae el proyecto, el montaje guardado y el cuadro.
        const d = await getCuadro(ejemploCuentaId);
        setBase({
          ctx: {
            numero: d.cuenta.numero,
            periodoInicio: d.cuenta.periodo_inicio,
            periodoFin: d.cuenta.periodo_fin,
            ordenProceder: d.cuenta.orden_proceder,
            proyectoNombre: d.cuenta.proyecto_nombre,
            clienteNombre: d.cuenta.cliente_nombre,
            itbmsTasa: d.cuenta.itbms_tasa,
            totales: calcTotales(d.lineas),
          },
          lineas: d.lineas,
          ajustesRaw: d.ajustesImpresion,
          ejemploNumero: d.cuenta.numero,
        });
        return;
      }
      // Sin cuentas todavía: el proyecto da el nombre y el cliente, y la tasa
      // de ITBMS sale del desglose oficial (es donde vive).
      const [p, desglose] = await Promise.all([
        getProyectoImpresion(projectId),
        getDesglose(projectId).catch(() => null),
      ]);
      setBase({
        ctx: {
          numero: 1,
          periodoInicio: null,
          periodoFin: null,
          ordenProceder: p.ordenProceder,
          proyectoNombre: p.nombre,
          clienteNombre: p.clienteNombre,
          itbmsTasa: desglose?.meta.itbmsTasa ?? null,
          totales: calcTotales([]),
        },
        lineas: [],
        ajustesRaw: p.ajustesImpresion,
        ejemploNumero: null,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId, ejemploCuentaId]);

  useEffect(() => { load(); }, [load]);

  /** Lo que llega del servidor no se vuelve a guardar: solo lo que se escribe. */
  const reciénCargado = useRef(true);

  useEffect(() => {
    if (!base) return;
    reciénCargado.current = true;
    setAjustes(
      base.ajustesRaw
        ? normalizarAjustes(base.ajustesRaw, base.ctx)
        : ajustesPorDefecto(base.ctx),
    );
  }, [base]);

  const papel = useMemo(() => {
    let [Wmm, Hmm] = PRINT_PAPERS[PAPEL_HOJA.papel] ?? PRINT_PAPERS.legal;
    if (Wmm < Hmm) [Wmm, Hmm] = [Hmm, Wmm];
    return { Wmm, Hmm, marginMM: 10 };
  }, []);

  // ---- el ejemplo de la hoja ----
  const seq = useRef(0);
  useEffect(() => {
    if (!ajustes || !base || base.lineas.length === 0) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const [izq, der] = await Promise.all([
        resolveLogoSide(ajustes.logosIzq),
        resolveLogoSide(ajustes.logosDer),
      ]);
      const { pages, layout } = buildCuadroPrintPages(
        aOpcionesImpresion(ajustes, base.ctx, papel, { izq: izq.urls, der: der.urls }),
        { lineas: base.lineas },
      );
      if (n !== seq.current) return;
      setPaginas(
        layout.errTableTooWide
          ? { svgs: [], err: 'La tabla no cabe a lo ancho del papel.' }
          : { svgs: pages, err: null },
      );
    }, 250);
    return () => clearTimeout(t);
  }, [ajustes, base, papel]);

  // ---- guardado con retardo ----
  // En un efecto y no dentro del actualizador de estado: React puede correr el
  // actualizador dos veces y una petición no es algo que deba repetirse.
  useEffect(() => {
    if (!ajustes) return;
    if (reciénCargado.current) {
      reciénCargado.current = false;
      return;
    }
    setGuardado('guardando');
    const t = setTimeout(async () => {
      try {
        // El papel no se elige en ningún lado: se escribe fijo con el montaje.
        await guardarAjustesImpresion(projectId, {
          ...ajustes,
          papel: PAPEL_HOJA.papel,
          orientacion: PAPEL_HOJA.orientacion,
        });
        setGuardado('limpio');
      } catch {
        setGuardado('error');
      }
    }, 800);
    return () => clearTimeout(t);
  }, [ajustes, projectId]);

  // ---- deshacer ----
  // Se guarda solo, así que sin historial un borrado no tiene vuelta atrás.
  // Escribir seguido no llena la pila: una ráfaga de teclas cuenta como un
  // paso; los cambios de estructura (poner o quitar algo) cuentan siempre.
  const historial = useRef<AjustesImpresion[]>([]);
  const ultimoPaso = useRef(0);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);

  const editar = (fn: (a: AjustesImpresion) => AjustesImpresion, pasoPropio = false) => {
    if (!ajustes) return;
    const ahora = Date.now();
    if (pasoPropio || ahora - ultimoPaso.current > 700) {
      historial.current = [...historial.current.slice(-49), ajustes];
      ultimoPaso.current = ahora;
      setPuedeDeshacer(true);
    }
    setAjustes(fn(ajustes));
  };

  const deshacer = () => {
    const h = historial.current;
    if (h.length === 0) return;
    historial.current = h.slice(0, -1);
    ultimoPaso.current = 0;
    setPuedeDeshacer(historial.current.length > 0);
    setAjustes(h[h.length - 1]);
  };

  const editarLinea = (col: number, i: number, patch: Partial<LineaImpresion>) =>
    editar((a) => ({
      ...a,
      columnas: a.columnas.map((c, ci) =>
        ci === col ? c.map((l, li) => (li === i ? { ...l, ...patch } : l)) : c,
      ) as AjustesImpresion['columnas'],
    }));

  const quitarLinea = (col: number, i: number) =>
    editar((a) => ({
      ...a,
      columnas: a.columnas.map((c, ci) =>
        ci === col ? c.filter((_, li) => li !== i) : c,
      ) as AjustesImpresion['columnas'],
    }), true);

  const moverLinea = (col: number, desde: number, hasta: number) =>
    editar((a) => ({
      ...a,
      columnas: a.columnas.map((c, ci) =>
        (ci === col ? mover(c, desde, hasta) : c),
      ) as AjustesImpresion['columnas'],
    }), true);

  const agregarTitulo = (r: RenglonTitulo) =>
    editar((a) => ({ ...a, titulo: [...a.titulo, r] }), true);

  const editarFirma = (i: number, fn: (f: FirmaImpresion) => FirmaImpresion, pasoPropio = false) =>
    editar((a) => ({
      ...a,
      firmas: a.firmas.map((f, j) => (j === i ? fn(f) : f)),
    }), pasoPropio);

  /** `pos` solo aplica al reponer una línea automática en su columna de
   *  origen: vuelve a su sitio en vez de caer al final. */
  const agregarLinea = (col: number, linea: LineaImpresion, pos?: number) =>
    editar((a) => ({
      ...a,
      columnas: a.columnas.map((c, ci) => {
        if (ci !== col) return c;
        if (pos == null) return [...c, linea];
        const next = [...c];
        next.splice(Math.min(pos, next.length), 0, linea);
        return next;
      }) as AjustesImpresion['columnas'],
    }), true);

  // ---- render ----
  const encabezado = (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Volver a cuentas"
        className="-ml-2 h-8 w-8 shrink-0 self-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <PageHeader
        title="Configurar Cuenta"
        subtitle="El encabezado de la hoja que se entrega en la institución. Se llena una vez y vale para todas las cuentas del proyecto."
      />
      {base && ajustes && (
        <div className="ml-auto flex items-center gap-3">
          <EstadoGuardado estado={guardado} />
          <Button variant="outline" onClick={deshacer} disabled={!puedeDeshacer}>
            <Undo2 className="h-4 w-4" />
            Deshacer
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="h-4 w-4" />
                Restaurar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Volver al encabezado original?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se reemplaza todo lo que hayas escrito — título, columnas,
                  firmas y logos — por el montaje con el que arranca un proyecto.
                  Se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => editar(() => ajustesPorDefecto(base.ctx), true)}>
                  Restaurar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );

  if (loading) return <div className="space-y-4">{encabezado}<TableSkeleton rows={6} /></div>;
  if (error || !base || !ajustes) {
    return <div className="space-y-4">{encabezado}<ErrorState onRetry={load} /></div>;
  }

  const { ctx } = base;
  const marginPct = (papel.marginMM / papel.Wmm) * 100;
  const faltantes = autoFaltantes(ajustes, ctx);

  const panel = (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2.5 p-3">
          <Titulo texto="Encabezado" />
          <p className="text-[13px] text-muted-foreground">
            Lo marcado <ChipAuto /> lo calcula el sistema desde el cuadro de cada
            cuenta y no se escribe a mano.
          </p>

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Título
            </span>
            {ajustes.titulo.map((r, i) => (
              <div key={i} className="flex items-center gap-1">
                <CampoOrdenable
                  i={i}
                  total={ajustes.titulo.length}
                  onMover={(d, h) => editar((x) => ({ ...x, titulo: mover(x.titulo, d, h) }), true)}
                >
                  {r.origen
                    ? <FilaAuto plano texto={`Cuenta No. ${ctx.numero}`} />
                    : (
                      <Input
                        className={campoPlano}
                        placeholder={`Renglón ${i + 1}`}
                        value={r.texto}
                        onChange={(e) => editar((a) => ({
                          ...a,
                          titulo: a.titulo.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)),
                        }))}
                      />
                    )}
                </CampoOrdenable>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-error"
                  aria-label="Quitar renglón del título"
                  onClick={() => editar((a) => ({
                    ...a,
                    titulo: a.titulo.filter((_, j) => j !== i),
                  }), true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {ajustes.titulo.length < MAX_TITULO_LINEAS && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" /> Renglón
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => agregarTitulo({ texto: '' })}>
                    En blanco
                  </DropdownMenuItem>
                  {/* El renglón automático se puede quitar y volver a poner,
                      arriba o abajo de los que escribes. */}
                  {!ajustes.titulo.some((r) => r.origen) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2"
                        onSelect={() => agregarTitulo({ texto: '', origen: 'numeroCuenta' })}
                      >
                        Cuenta No. <ChipAuto />
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {ajustes.columnas.map((col, ci) => (
            <div key={ci} className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {COLUMNA_TITULOS[ci]}
              </span>
              {/* Etiqueta y valor en la misma fila: apilados, cada línea medía
                  el doble y el panel se hacía más alto que la hoja. */}
              {col.map((l, li) => (
                <div key={li} className="flex items-center gap-1">
                  <CampoOrdenable
                    i={li}
                    total={col.length}
                    onMover={(d, h) => moverLinea(ci, d, h)}
                  >
                    <Input
                      className={`${campoPlano} w-[45%] shrink-0 border-r border-input`}
                      placeholder="Etiqueta"
                      value={l.etiqueta}
                      onChange={(e) => editarLinea(ci, li, { etiqueta: e.target.value })}
                    />
                    {l.origen ? (
                      <FilaAuto plano texto={valorDe(l, ctx)} />
                    ) : (
                      <Input
                        className={campoPlano}
                        placeholder="Valor"
                        value={l.valor}
                        onChange={(e) => editarLinea(ci, li, { valor: e.target.value })}
                      />
                    )}
                  </CampoOrdenable>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-error"
                    aria-label="Quitar línea"
                    onClick={() => quitarLinea(ci, li)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {/* El menú es lo que hace reversible borrar una línea `auto`:
                  las que falten se pueden volver a poner desde aquí. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" /> Línea
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => agregarLinea(ci, { etiqueta: '', valor: '' })}>
                    En blanco
                  </DropdownMenuItem>
                  {faltantes.length > 0 && <DropdownMenuSeparator />}
                  {faltantes.map((f) => (
                    <DropdownMenuItem
                      key={f.linea.origen}
                      className="gap-2"
                      onSelect={() => agregarLinea(ci, f.linea, f.col === ci ? f.pos : undefined)}
                    >
                      {f.linea.etiqueta} <ChipAuto />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2.5 p-3">
          <EditorFirmas
            firmas={ajustes.firmas}
            onChange={(v, est) => editar((a) => ({ ...a, firmas: v }), est)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2.5 p-3">
          <Titulo texto="Logos" />
          {/* Los dos lados se separan con una línea, no con cajas dentro de la
              card (FRONTEND_CONVENTIONS §8), y los dos tienen la misma forma
              aunque uno esté vacío. */}
          <EditorLogos
            label="Izquierda"
            valores={ajustes.logosIzq}
            onChange={(v) => editar((a) => ({ ...a, logosIzq: v }), true)}
            onAviso={setAviso}
          />
          <div className="border-t border-border pt-4">
            <EditorLogos
              label="Derecha"
              valores={ajustes.logosDer}
              onChange={(v) => editar((a) => ({ ...a, logosDer: v }), true)}
              onAviso={setAviso}
            />
          </div>
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            La hoja se imprime siempre en papel legal horizontal.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2.5 p-3">
          <Titulo texto="Color" />
          <p className="text-xs text-muted-foreground">
            De este color salen la banda del encabezado, el pie y los tonos de
            cada nivel del desglose.
          </p>
          <EditorColor
            valor={ajustes.color}
            onChange={(hex) => editar((a) => ({ ...a, color: hex }), true)}
            nivelesBlancos={ajustes.nivelesBlancos}
            onNivelesBlancos={(n) => editar((a) => ({ ...a, nivelesBlancos: n }), true)}
          />
        </CardContent>
      </Card>
    </div>
  );

  // Las páginas de la hoja. Salen igual en la columna de la derecha y dentro
  // del diálogo de Expandir; lo único que cambia es el ancho que las contiene.
  const hoja = paginas == null ? (
    <p className="py-16 text-center text-sm text-slate-600">Armando la hoja…</p>
  ) : paginas.err ? (
    <Alert variant="error" title={paginas.err} />
  ) : (
    paginas.svgs.map((p, i) => (
      <figure key={i} className="m-0">
        {/* El papel COMPLETO: el margen real se dibuja como padding
            (porcentaje del ancho — valor dinámico, no expresable en
            Tailwind) y adentro va el mismo SVG que se imprime. */}
        <div className="bg-white shadow-md" style={{ padding: `${marginPct}%` }}>
          <div
            className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: p }}
          />
        </div>
        <figcaption className="mt-1.5 text-center text-xs text-slate-700">
          Página {i + 1} de {paginas.svgs.length}
        </figcaption>
      </figure>
    ))
  );

  return (
    <div className="space-y-4">
      {encabezado}

      {aviso && <Alert variant="error" title={aviso} />}

      {/* En pantalla ancha la página NO scrollea: el alto se fija y cada
          columna baja por su cuenta. Es lo único que garantiza que la hoja no
          se mueva mientras se edita — `sticky` depende de la cadena de
          contenedores de arriba y aquí no llegaba a pegarse. */}
      <div className="grid grid-cols-1 items-start gap-4 xl:h-[calc(100vh-12rem)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="min-w-0 xl:h-full xl:overflow-y-auto xl:pr-2">
          {panel}
        </div>

        {/* ---- el ejemplo ---- */}
        {/* Sin cuadro del que sacar la tabla no hay hoja que dibujar: puede que
            el proyecto no tenga cuentas todavía, o que la última no tenga
            desglose. */}
        {base.ejemploNumero == null || base.lineas.length === 0 ? (
          <Card className="hidden xl:block xl:h-full">
            <CardContent className="flex h-full items-center justify-center p-8">
              <p className="max-w-xs text-center text-sm text-muted-foreground">
                Cuando el proyecto tenga una cuenta con desglose, aquí se verá la
                hoja con este encabezado.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="min-w-0 space-y-3 rounded-xl bg-slate-300 p-4 xl:h-full xl:overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-700">
                Ejemplo con la Cuenta {base.ejemploNumero}. Aquí solo se mira.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-shrink-0"
                onClick={() => setExpandido(true)}
              >
                <Maximize2 className="h-3.5 w-3.5" /> Expandir
              </Button>
            </div>
            {hoja}
          </div>
        )}
      </div>

      {/* La misma hoja, al ancho que dé la pantalla. Solo se mira: se cierra
          con Esc o con la equis, y por eso no lleva pie de botones. */}
      <AppDialog
        open={expandido}
        onOpenChange={setExpandido}
        size="viewer"
        title={`Cuenta ${base.ejemploNumero ?? ''} — ejemplo de la hoja`}
      >
        <div className="space-y-3 rounded-lg bg-slate-300 p-4">{hoja}</div>
      </AppDialog>
    </div>
  );
}
