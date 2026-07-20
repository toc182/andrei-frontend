// DesglosePrintDialog — options + LIVE PREVIEW for the desglose print/PDF.
// Form state + orchestration ONLY: the pages come from the pure builder in
// desglosePrint.ts; the preview renders those exact SVG pages scaled down, so
// what you see is literally what prints. No persistence (v1): every open
// starts from the defaults.
//
// The preview rebuilds debounced (250ms) on every settings change, with a
// sequence guard so a slow logo resolve can never overwrite a newer preview.

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  PRINT_PAPERS, PRINT_FONTS, MAX_LOGOS_PER_SIDE, openPrintWindow,
} from '@/lib/cronogramaPrint';
import { buildDesglosePrintPages } from '@/lib/desglosePrint';
import { resolveLogoSide } from '@/lib/printLogos';
import type { LogoChoice } from '@/lib/cronogramaApi';
import type { DesgloseRow } from '@/lib/desgloseModel';

const PREVIEW_MAX_PAGES = 4;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaHoy = () => {
  const d = new Date();
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};

interface Ajustes {
  papel: string; // key de PRINT_PAPERS o 'custom'
  customWmm: number | null;
  customHmm: number | null;
  orientacion: 'vertical' | 'horizontal';
  margenMM: number;
  letra: keyof typeof PRINT_FONTS;
  maxPaginasAlto: number; // 0 = auto
  titulo: string;
  subtitulo: string;
  logosIzq: LogoChoice[];
  logosDer: LogoChoice[];
}

const DEFAULTS: Ajustes = {
  papel: 'letter', customWmm: null, customHmm: null, orientacion: 'vertical',
  margenMM: 10, letra: 'normal', maxPaginasAlto: 0,
  titulo: '', subtitulo: 'Desglose de Precios',
  logosIzq: ['pinellas'], logosDer: [],
};

type LogoSide = 'logosIzq' | 'logosDer';

interface Preview {
  pages: string[]; // solo las primeras PREVIEW_MAX_PAGES
  total: number;
  warn: string | null;
  err: string | null;
  /** Margen como % del ancho del papel — la hoja de la vista previa lo dibuja
   *  como padding para que se vea la página COMPLETA, no solo el área impresa. */
  marginPct: number;
}

interface DesglosePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: DesgloseRow[];
  itbmsTasa: number | null;
  /** Nombre del proyecto — título por defecto del documento. */
  proyectoNombre?: string;
}

export function DesglosePrintDialog({
  open, onOpenChange, rows, itbmsTasa, proyectoNombre,
}: DesglosePrintDialogProps) {
  const [a, setA] = useState<Ajustes>(DEFAULTS);
  const [masOpciones, setMasOpciones] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null); // errores al Generar (popup, logos)
  const [busy, setBusy] = useState(false);

  // Sin persistencia: cada apertura arranca limpia desde los defaults.
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPreview(null);
    setMasOpciones(false);
    setA(DEFAULTS);
  }, [open]);

  const set = <K extends keyof Ajustes>(k: K, v: Ajustes[K]) =>
    setA((prev) => ({ ...prev, [k]: v }));

  // ----- paper/margin resolution shared by preview and Generar -----
  const resolvePaper = (): { err: string } | { Wmm: number; Hmm: number; marginMM: number } => {
    let Wmm: number, Hmm: number;
    if (a.papel === 'custom') {
      if (!a.customWmm || !a.customHmm || a.customWmm <= 0 || a.customHmm <= 0) {
        return { err: 'Indica ancho y alto válidos para el papel personalizado.' };
      }
      Wmm = a.customWmm;
      Hmm = a.customHmm;
    } else {
      [Wmm, Hmm] = PRINT_PAPERS[a.papel] ?? PRINT_PAPERS.letter;
    }
    // PRINT_PAPERS viene en vertical (W < H); la orientación decide si se voltea.
    if (a.orientacion === 'vertical' ? Wmm > Hmm : Wmm < Hmm) [Wmm, Hmm] = [Hmm, Wmm];
    const marginMM = Math.max(0, Math.min(40, a.margenMM || 0));
    if (Wmm - 2 * marginMM < 20 || Hmm - 2 * marginMM < 20) {
      return { err: 'Margen demasiado grande para el papel.' };
    }
    return { Wmm, Hmm, marginMM };
  };

  const construir = async () => {
    const paper = resolvePaper();
    if ('err' in paper) return { err: paper.err };
    const [izq, der] = await Promise.all([resolveLogoSide(a.logosIzq), resolveLogoSide(a.logosDer)]);
    const title = a.titulo.trim() || proyectoNombre || 'Desglose de Precios';
    const { pages, layout } = buildDesglosePrintPages(
      {
        ...paper, fontKey: a.letra, maxTall: a.maxPaginasAlto,
        title, subtitle: a.subtitulo.trim(), fecha: fechaHoy(),
        logosLeft: izq.urls, logosRight: der.urls,
      },
      { rows, itbmsTasa },
    );
    if (layout.errTableTooWide) {
      return { err: 'La tabla no cabe a lo ancho: usa letra más pequeña, papel más grande u orientación horizontal.' };
    }
    return { pages, layout, title, paper, logoFailed: izq.failed || der.failed };
  };

  // ----- live preview (debounced + sequence-guarded) -----
  const previewSeq = useRef(0);
  useEffect(() => {
    if (!open) return;
    const seq = ++previewSeq.current;
    const t = setTimeout(async () => {
      const r = await construir();
      if (seq !== previewSeq.current) return; // una vista más nueva ya manda
      if ('err' in r) {
        setPreview({ pages: [], total: 0, warn: null, err: r.err, marginPct: 0 });
        return;
      }
      setPreview({
        pages: r.pages.slice(0, PREVIEW_MAX_PAGES),
        total: r.pages.length,
        warn: r.layout.warn,
        err: null,
        marginPct: (r.paper.marginMM / r.paper.Wmm) * 100,
      });
    }, 250);
    return () => clearTimeout(t);
    // construir lee `a`/`rows`/`itbmsTasa`/`proyectoNombre` — todos listados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, a, rows, itbmsTasa, proyectoNombre]);

  // ----- logos -----
  const logoFileRefs = {
    logosIzq: useRef<HTMLInputElement>(null),
    logosDer: useRef<HTMLInputElement>(null),
  };
  const pendingLogoSlot = useRef<{ side: LogoSide; index: number } | null>(null);

  const setLogo = (side: LogoSide, index: number, v: LogoChoice) =>
    setA((prev) => ({ ...prev, [side]: prev[side].map((c, j) => (j === index ? v : c)) }));
  const removeLogo = (side: LogoSide, index: number) =>
    setA((prev) => ({ ...prev, [side]: prev[side].filter((_, j) => j !== index) }));
  const addLogo = (side: LogoSide) =>
    setA((prev) =>
      prev[side].length >= MAX_LOGOS_PER_SIDE
        ? prev
        : { ...prev, [side]: [...prev[side], 'pinellas' as LogoChoice] });

  const onLogoSelect = (side: LogoSide, index: number) => (v: string) => {
    if (v === 'otro') {
      pendingLogoSlot.current = { side, index };
      logoFileRefs[side].current?.click();
      return;
    }
    setLogo(side, index, v as LogoChoice);
  };

  const onLogoFile = (side: LogoSide) => async (e: ChangeEvent<HTMLInputElement>) => {
    setErr(null);
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    const slot = pendingLogoSlot.current;
    pendingLogoSlot.current = null;
    if (!slot || slot.side !== side) return;
    if (!f.type.startsWith('image/')) {
      setErr('El logo debe ser una imagen.');
      return;
    }
    const dataUrl = await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(f);
    });
    if (!dataUrl) {
      setErr('No se pudo leer el logo.');
      return;
    }
    if (dataUrl.length > 400_000) {
      setErr('Logo demasiado grande (máx. ~400 KB). Usa una imagen más liviana.');
      return;
    }
    setLogo(side, slot.index, { dataUrl });
  };

  // ----- generar -----
  const generar = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await construir();
      if ('err' in r) {
        setErr(r.err);
        return;
      }
      if (!openPrintWindow(r.pages, { ...r.paper, docTitle: r.title })) {
        setErr('El navegador bloqueó la ventana de impresión — permite ventanas emergentes para este sitio.');
        return;
      }
      if (r.logoFailed) {
        setErr('No se pudo cargar un logo; se imprimió sin él.');
        return;
      }
      onOpenChange(false);
    } catch (e) {
      console.error('Error generando PDF de desglose:', e);
      setErr('No se pudo generar el PDF; intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const logoList = (side: LogoSide, label: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {a[side].map((c, j) => (
        <div key={j} className="flex items-center gap-1.5">
          <Select value={typeof c === 'string' ? c : 'otro'} onValueChange={onLogoSelect(side, j)}>
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pinellas">Pinellas</SelectItem>
              <SelectItem value="cocp">COCP</SelectItem>
              <SelectItem value="otro">Otra imagen…</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" aria-label="Quitar logo"
            onClick={() => removeLogo(side, j)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {a[side].length < MAX_LOGOS_PER_SIDE && (
        <Button type="button" variant="outline" size="sm" onClick={() => addLogo(side)}>
          Agregar logo
        </Button>
      )}
      <Input ref={logoFileRefs[side]} type="file" accept="image/*" onChange={onLogoFile(side)} className="hidden" />
    </div>
  );

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="complex"
      title="Imprimir / PDF"
      description="Ajusta las opciones y revisa la vista previa; Generar abre la ventana de impresión, donde puedes imprimir o guardar como PDF."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={generar} disabled={busy}>{busy ? 'Generando…' : 'Imprimir'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* ----- ajustes ----- */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tamaño de papel</Label>
              <Select value={a.papel} onValueChange={(v) => set('papel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Carta</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="a3">A3</SelectItem>
                  <SelectItem value="tabloid">Tabloide</SelectItem>
                  <SelectItem value="custom">Personalizado…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Orientación</Label>
              <Select value={a.orientacion} onValueChange={(v) => set('orientacion', v as Ajustes['orientacion'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">Vertical</SelectItem>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {a.papel === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ancho (mm)</Label>
                <Input type="number" min={1} className="tabular-nums" value={a.customWmm ?? ''}
                  onChange={(e) => set('customWmm', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Alto (mm)</Label>
                <Input type="number" min={1} className="tabular-nums" value={a.customHmm ?? ''}
                  onChange={(e) => set('customHmm', parseFloat(e.target.value) || null)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tamaño de letra</Label>
              <Select value={a.letra} onValueChange={(v) => set('letra', v as Ajustes['letra'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="grande">Grande</SelectItem>
                  <SelectItem value="extra">Extra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Máx. páginas de alto</Label>
              <Input type="number" min={0} step={1} className="tabular-nums" value={a.maxPaginasAlto}
                onChange={(e) => set('maxPaginasAlto', Math.max(0, parseInt(e.target.value, 10) || 0))} />
              <p className="text-xs text-muted-foreground">0 = automático. Si no cabe, la letra se reduce.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={a.titulo} placeholder={proyectoNombre ?? 'Nombre del proyecto'}
              onChange={(e) => set('titulo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Subtítulo</Label>
            <Input value={a.subtitulo}
              onChange={(e) => set('subtitulo', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {logoList('logosIzq', 'Logos izquierda')}
            {logoList('logosDer', 'Logos derecha')}
          </div>

          <div>
            <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground"
              onClick={() => setMasOpciones((v) => !v)}>
              {masOpciones ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
              Más opciones
            </Button>
            {masOpciones && (
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Margen (mm)</Label>
                  <Input type="number" min={0} max={40} step={1} className="tabular-nums" value={a.margenMM}
                    onChange={(e) => set('margenMM', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            )}
          </div>

          {err && <Alert variant="error" title={err} />}
        </div>

        {/* ----- vista previa ----- */}
        <div className="space-y-2">
          <Label>Vista previa</Label>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-md border border-border bg-muted/40 p-3">
            {preview == null ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Generando vista previa…</p>
            ) : preview.err ? (
              <Alert variant="error" title={preview.err} />
            ) : (
              <>
                {preview.pages.map((p, i) => (
                  <figure key={i}>
                    {/* La hoja completa: el margen real se dibuja como padding
                        (% del ancho del papel — valor dinámico, no expresable en
                        Tailwind) y adentro va el MISMO SVG que se imprime,
                        generado y escapado por el builder puro. */}
                    <div
                      className="border border-border bg-white shadow-sm"
                      style={{ padding: `${preview.marginPct}%` }}
                    >
                      <div
                        className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: p }}
                      />
                    </div>
                    <figcaption className="mt-1 text-center text-xs text-muted-foreground">
                      Página {i + 1} de {preview.total}
                    </figcaption>
                  </figure>
                ))}
                {preview.total > preview.pages.length && (
                  <p className="text-center text-xs text-muted-foreground">
                    …y {preview.total - preview.pages.length} página{preview.total - preview.pages.length === 1 ? '' : 's'} más
                  </p>
                )}
              </>
            )}
          </div>
          {preview?.warn && <Alert variant="warning" title={preview.warn} />}
        </div>
      </div>
    </AppDialog>
  );
}
