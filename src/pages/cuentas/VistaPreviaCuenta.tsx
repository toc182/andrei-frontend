// src/pages/cuentas/VistaPreviaCuenta.tsx — la hoja que se imprime y se
// entrega en la institución, tal como va a salir, con el panel donde se llena
// lo que el sistema no sabe.
//
// Es una PANTALLA propia, como el cuadro (FRONTEND_CONVENTIONS §23): se entra
// desde la cuenta y se sale con la flecha. Dos decisiones que la explican:
//
//   · La vista previa NO vive dentro del diálogo de impresión. Ver la hoja es
//     lo normal; imprimirla es el final. Por eso la hoja ocupa la pantalla y
//     el botón Imprimir es una acción más de la barra.
//   · Lo que se escribe se escribe en el panel de al lado, no sobre el papel:
//     a 6.5 pt cada dato mide unos 2 mm de alto y hay valores que ocupan tres
//     líneas. La hoja se actualiza mientras escribes, así que igual se corrige
//     mirando el resultado.
//
// Las páginas son EXACTAMENTE las que se imprimen: el mismo builder puro
// (cuadroPrint.ts), sin una segunda versión "de pantalla" que pueda desviarse.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Printer, Trash2 } from 'lucide-react';
import { PageHeader, ErrorState, TableSkeleton } from '@/components/shell';
import { Alert } from '@/components/shell/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { PRINT_PAPERS, openPrintWindow } from '@/lib/cronogramaPrint';
import { buildCuadroPrintPages } from '@/lib/cuadroPrint';
import { resolveLogoSide } from '@/lib/printLogos';
import { calcTotales } from '@/lib/cuadroModel';
import {
  ajustesPorDefecto, aOpcionesImpresion, normalizarAjustes, valorDe,
  COLUMNA_TITULOS,
  type AjustesImpresion, type CtxImpresion, type LineaImpresion,
} from '@/lib/cuentaImpresion';
import {
  getCuadro, guardarAjustesImpresion, type CuadroDoc,
} from '@/lib/cuadroApi';
import {
  ChipAuto, EditorFirmas, EditorLogos, EstadoGuardado, Titulo, type Guardado,
} from './impresionPiezas';

interface Props {
  cuentaId: number;
  onBack?: () => void;
}

export default function VistaPreviaCuenta({ cuentaId, onBack }: Props) {
  const [doc, setDoc] = useState<CuadroDoc | null>(null);
  const [ajustes, setAjustes] = useState<AjustesImpresion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [guardado, setGuardado] = useState<Guardado>('limpio');
  const [imprimiendo, setImprimiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [paginas, setPaginas] = useState<{ svgs: string[]; warn: string | null; err: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const d = await getCuadro(cuentaId);
      setDoc(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cuentaId]);

  useEffect(() => { load(); }, [load]);

  // Lo que el sistema sabe. Los porcentajes y los montos salen del cuadro, no
  // de una copia guardada: es lo que impide que el encabezado se desvíe del
  // pie de la tabla.
  const ctx = useMemo<CtxImpresion | null>(() => {
    if (!doc) return null;
    return {
      numero: doc.cuenta.numero,
      periodoInicio: doc.cuenta.periodo_inicio,
      periodoFin: doc.cuenta.periodo_fin,
      ordenProceder: doc.cuenta.orden_proceder,
      proyectoNombre: doc.cuenta.proyecto_nombre,
      clienteNombre: doc.cuenta.cliente_nombre,
      itbmsTasa: doc.cuenta.itbms_tasa,
      totales: calcTotales(doc.lineas),
    };
  }, [doc]);

  /** Lo que llega del servidor no se vuelve a guardar: solo lo que se escribe. */
  const reciénCargado = useRef(true);

  // El montaje guardado se completa con los valores por defecto: un JSONB
  // viejo al que le falte una clave no puede tumbar la pantalla.
  useEffect(() => {
    if (!doc || !ctx) return;
    reciénCargado.current = true;
    setAjustes(
      doc.ajustesImpresion
        ? normalizarAjustes(doc.ajustesImpresion, ctx)
        : ajustesPorDefecto(ctx),
    );
    // Solo al cargar: después manda lo que se escribe en el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // ---- papel ----
  const papel = useMemo(() => {
    if (!ajustes) return null;
    let [Wmm, Hmm] = PRINT_PAPERS[ajustes.papel] ?? PRINT_PAPERS.legal;
    if (ajustes.orientacion === 'vertical' ? Wmm > Hmm : Wmm < Hmm) [Wmm, Hmm] = [Hmm, Wmm];
    return { Wmm, Hmm, marginMM: 10 };
  }, [ajustes]);

  // ---- construcción de las páginas (con retardo y guardia de secuencia) ----
  const seq = useRef(0);
  const construir = useCallback(async () => {
    if (!doc || !ctx || !ajustes || !papel) return null;
    const [izq, der] = await Promise.all([
      resolveLogoSide(ajustes.logosIzq),
      resolveLogoSide(ajustes.logosDer),
    ]);
    const { pages, layout } = buildCuadroPrintPages(
      aOpcionesImpresion(ajustes, ctx, papel, { izq: izq.urls, der: der.urls }),
      { lineas: doc.lineas },
    );
    return { pages, layout };
  }, [doc, ctx, ajustes, papel]);

  useEffect(() => {
    if (!ajustes) return;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const r = await construir();
      if (n !== seq.current || !r) return;
      setPaginas(
        r.layout.errTableTooWide
          ? {
            svgs: [], warn: null,
            err: 'La tabla no cabe a lo ancho: usa letra más pequeña, papel más grande u orientación horizontal.',
          }
          : { svgs: r.pages, warn: r.layout.warn, err: null },
      );
    }, 250);
    return () => clearTimeout(t);
  }, [construir, ajustes]);

  // ---- guardado con retardo ----
  // Va en un efecto y no dentro del actualizador de estado: React puede
  // ejecutar el actualizador dos veces y una petición no es algo que deba
  // repetirse por eso.
  useEffect(() => {
    if (!ajustes || !doc) return;
    if (reciénCargado.current) {
      reciénCargado.current = false;
      return;
    }
    setGuardado('guardando');
    const t = setTimeout(async () => {
      try {
        await guardarAjustesImpresion(doc.cuenta.proyecto_id, ajustes);
        setGuardado('limpio');
      } catch {
        setGuardado('error');
      }
    }, 800);
    return () => clearTimeout(t);
  }, [ajustes, doc]);

  const editar = useCallback(
    (fn: (a: AjustesImpresion) => AjustesImpresion) =>
      setAjustes((prev) => (prev ? fn(prev) : prev)),
    [],
  );

  const editarLinea = (col: number, i: number, patch: Partial<LineaImpresion>) =>
    editar((a) => {
      const columnas = a.columnas.map((c, ci) =>
        ci === col ? c.map((l, li) => (li === i ? { ...l, ...patch } : l)) : c,
      ) as AjustesImpresion['columnas'];
      return { ...a, columnas };
    });

  const quitarLinea = (col: number, i: number) =>
    editar((a) => ({
      ...a,
      columnas: a.columnas.map((c, ci) =>
        ci === col ? c.filter((_, li) => li !== i) : c,
      ) as AjustesImpresion['columnas'],
    }));

  const agregarLinea = (col: number) =>
    editar((a) => ({
      ...a,
      columnas: a.columnas.map((c, ci) =>
        ci === col ? [...c, { etiqueta: '', valor: '' }] : c,
      ) as AjustesImpresion['columnas'],
    }));

  // ---- imprimir ----
  const imprimir = async () => {
    if (!papel || !doc) return;
    setAviso(null);
    setImprimiendo(true);
    try {
      const r = await construir();
      if (!r || r.layout.errTableTooWide) {
        setAviso('La tabla no cabe a lo ancho: cambia el papel, la orientación o la letra.');
        return;
      }
      const ok = openPrintWindow(r.pages, {
        ...papel,
        docTitle: `Cuenta ${doc.cuenta.numero} — ${doc.cuenta.proyecto_nombre}`,
      });
      if (!ok) {
        setAviso('El navegador bloqueó la ventana de impresión — permite ventanas emergentes para este sitio.');
      }
    } finally {
      setImprimiendo(false);
    }
  };

  // ---- render ----
  const encabezado = (
    <div className="flex items-center gap-3">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Volver a la cuenta"
          className="-ml-2 h-8 w-8 shrink-0 self-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <PageHeader
        title="Vista previa"
        subtitle={doc ? `Cuenta ${doc.cuenta.numero} · ${doc.cuenta.proyecto_nombre}` : undefined}
      />
      {doc && (
        <div className="ml-auto flex items-center gap-3">
          <EstadoGuardado estado={guardado} />
          <Button onClick={imprimir} disabled={imprimiendo || !paginas || !!paginas.err}>
            {imprimiendo
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Printer className="mr-2 h-4 w-4" />}
            Imprimir
          </Button>
        </div>
      )}
    </div>
  );

  if (loading) return <div className="space-y-4">{encabezado}<TableSkeleton rows={6} /></div>;
  if (error || !doc || !ajustes || !ctx || !papel) {
    return <div className="space-y-4">{encabezado}<ErrorState onRetry={load} /></div>;
  }

  const marginPct = (papel.marginMM / papel.Wmm) * 100;

  return (
    <div className="space-y-4">
      {encabezado}

      {aviso && <Alert variant="error" title={aviso} />}
      {paginas?.warn && <Alert variant="warning" title={paginas.warn} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* ---- la hoja ---- */}
        <div className="min-w-0 space-y-3 rounded-xl bg-slate-300 p-4">
          {paginas == null ? (
            <p className="py-16 text-center text-sm text-slate-600">Armando la hoja…</p>
          ) : paginas.err ? (
            <Alert variant="error" title={paginas.err} />
          ) : (
            paginas.svgs.map((p, i) => (
              <figure key={i} className="m-0">
                {/* El papel COMPLETO: el margen real se dibuja como padding
                    (porcentaje del ancho — valor dinámico, no expresable en
                    Tailwind) y adentro va el mismo SVG que se imprime. */}
                <div
                  className="bg-white shadow-md"
                  style={{ padding: `${marginPct}%` }}
                >
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
          )}
        </div>

        {/* ---- el panel ---- */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              <Titulo texto="Encabezado" />
              <p className="text-[13px] text-muted-foreground">
                Lo marcado <ChipAuto /> lo calcula el sistema desde el cuadro y no se escribe a mano.
              </p>

              {/* El título es del PROYECTO: se arma una vez en Configurar
                  Cuenta y aquí solo se lee. */}
              <div className="space-y-2">
                <Label>Título</Label>
                {ajustes.titulo.map((r, i) => (
                  <p key={i} className="truncate text-sm text-muted-foreground">
                    {r.origen ? `Cuenta No. ${ctx.numero}` : r.texto || '—'}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground">
                  Se configura en Cuentas → Configurar Cuenta.
                </p>
              </div>

              {ajustes.columnas.map((col, ci) => (
                <div key={ci} className="space-y-2">
                  <Label>{COLUMNA_TITULOS[ci]}</Label>
                  {col.map((l, li) => (
                    <div key={li} className="flex items-start gap-1.5">
                      <div className="min-w-0 flex-1 space-y-1">
                        <Input
                          className="h-8 text-[13px]"
                          placeholder="Etiqueta"
                          value={l.etiqueta}
                          onChange={(e) => editarLinea(ci, li, { etiqueta: e.target.value })}
                        />
                        {l.origen ? (
                          <div className="flex items-center gap-2 rounded-md border border-teal/30 bg-teal/[0.06] px-2.5 py-1">
                            <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                              {valorDe(l, ctx) || '—'}
                            </span>
                            <ChipAuto />
                          </div>
                        ) : (
                          <Input
                            className="h-8 text-[13px]"
                            placeholder="Valor"
                            value={l.valor}
                            onChange={(e) => editarLinea(ci, li, { valor: e.target.value })}
                          />
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-error"
                        aria-label="Quitar línea"
                        onClick={() => quitarLinea(ci, li)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-7 text-muted-foreground"
                    onClick={() => agregarLinea(ci)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Línea
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <EditorFirmas
                firmas={ajustes.firmas}
                onChange={(v) => editar((a) => ({ ...a, firmas: v }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <Titulo texto="Papel" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tamaño</Label>
                  <Select value={ajustes.papel} onValueChange={(v) => editar((a) => ({ ...a, papel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="letter">Carta</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="a4">A4</SelectItem>
                      <SelectItem value="a3">A3</SelectItem>
                      <SelectItem value="tabloid">Tabloide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Orientación</Label>
                  <Select
                    value={ajustes.orientacion}
                    onValueChange={(v) => editar((a) => ({ ...a, orientacion: v as AjustesImpresion['orientacion'] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horizontal">Horizontal</SelectItem>
                      <SelectItem value="vertical">Vertical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Letra</Label>
                  <Select
                    value={ajustes.letra}
                    onValueChange={(v) => editar((a) => ({ ...a, letra: v as AjustesImpresion['letra'] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compacta">Compacta</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="grande">Grande</SelectItem>
                      <SelectItem value="extra">Extra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Máx. páginas</Label>
                  <Input
                    type="number"
                    min={0}
                    className="tabular-nums"
                    value={ajustes.maxPaginas}
                    onChange={(e) => editar((a) => ({
                      ...a,
                      maxPaginas: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = las que hagan falta. Si pones un tope, la letra se reduce hasta caber.
                  </p>
                </div>
              </div>

              <EditorLogos
                label="Izquierda"
                valores={ajustes.logosIzq}
                onChange={(v) => editar((a) => ({ ...a, logosIzq: v }))}
                onAviso={setAviso}
              />
              <div className="border-t border-border pt-4">
                <EditorLogos
                  label="Derecha"
                  valores={ajustes.logosDer}
                  onChange={(v) => editar((a) => ({ ...a, logosDer: v }))}
                  onAviso={setAviso}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
