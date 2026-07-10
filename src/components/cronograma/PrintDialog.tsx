// PrintDialog — options dialog for cronograma print/PDF (ERP take on gantto's #pdfDialog).
// Form state + orchestration ONLY: resolves logo choices to data URLs, calls the pure
// builder in cronogramaPrint.ts, opens the print window, and persists the setup per
// cronograma (printing never blocks on the save — only the dialog close waits for it,
// so a failed save can actually be shown as a warning).

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { computeChartRange } from '@/lib/cronogramaGeometry';
import {
  PRINT_PAPERS, buildPrintPages, openPrintWindow,
  type PrintOptions, type PrintData,
} from '@/lib/cronogramaPrint';
import {
  saveAjustesImpresion,
  type AjustesImpresion, type ColumnaImpresion, type CronogramaConfig, type LogoChoice,
} from '@/lib/cronogramaApi';
import type { GanttRow } from '@/lib/cronogramaModel';
import type { ScheduleEntry, TaskId } from '@/lib/cronogramaEngine';
import logoPinellas from '@/assets/logo.png';
import logoCocp from '@/assets/LogoCOCPfondoblanco.png';

const COLUMN_OPTIONS: { key: ColumnaImpresion; label: string }[] = [
  { key: 'dur', label: 'Días' },
  { key: 'inicio', label: 'Inicio' },
  { key: 'fin', label: 'Fin' },
  { key: 'pct', label: '%' },
  { key: 'pred', label: 'Pred' },
];

const DEFAULT_AJUSTES: AjustesImpresion = {
  papel: 'legal', customWmm: null, customHmm: null, margenMM: 10, letra: 'normal',
  paginasAncho: 1, maxPaginasAlto: 0, reducirLetra: true,
  columnas: ['dur', 'inicio', 'fin', 'pct', 'pred'],
  titulo: '', subtitulo: '', logoIzq: 'pinellas', logoDer: 'none',
};

async function toDataUrl(url: string): Promise<string> {
  // fetch() on a Vite-bundled same-origin asset — NOT an API call; the axios instance
  // (baseURL /api + auth header) cannot load static assets, so the repo's no-fetch rule
  // doesn't apply here.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`logo asset ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('logo read failed'));
    r.readAsDataURL(blob);
  });
}

async function resolveLogo(choice: LogoChoice): Promise<string | null> {
  if (!choice || choice === 'none') return null;
  if (typeof choice === 'object') return choice.dataUrl;
  return toDataUrl(choice === 'pinellas' ? logoPinellas : logoCocp);
}

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: CronogramaConfig;
  rows: GanttRow[];
  computed: {
    schedule: Record<string, ScheduleEntry>;
    rollup: Record<string, number>;
    violations: Set<string>;
    critical: Set<string>;
    cycle: boolean;
  };
  showCritical: boolean;
  fullRowNum: Map<TaskId, number>;
  /** Reflect the persisted setup back into the workspace's config state.
   *  Carries the cronograma id the settings were saved FOR — the workspace may have
   *  switched to another cronograma while the PUT was in flight. */
  onSavedAjustes: (a: AjustesImpresion, cronogramaId: number) => void;
}

export function PrintDialog({
  open, onOpenChange, config, rows, computed, showCritical, fullRowNum, onSavedAjustes,
}: PrintDialogProps) {
  const [a, setA] = useState<AjustesImpresion>(DEFAULT_AJUSTES);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // (Re)seed from the saved setup on the closed→open transition ONLY — config.ajustesImpresion
  // also changes when OUR save round-trips (onSavedAjustes), and re-seeding then would wipe
  // the warning/edits while the dialog is still open.
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setWarn(null);
    const saved = { ...DEFAULT_AJUSTES, ...(config.ajustesImpresion ?? {}) };
    // JSONB is shape-unvalidated server-side: defend the keys whose corruption would throw.
    if (saved.papel !== 'custom' && !PRINT_PAPERS[saved.papel]) saved.papel = 'legal';
    saved.columnas = Array.isArray(saved.columnas)
      ? saved.columnas.filter((c) => COLUMN_OPTIONS.some((o) => o.key === c))
      : DEFAULT_AJUSTES.columnas;
    setA(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof AjustesImpresion>(k: K, v: AjustesImpresion[K]) =>
    setA((prev) => ({ ...prev, [k]: v }));

  const toggleCol = (key: ColumnaImpresion, on: boolean) =>
    setA((prev) => ({
      ...prev,
      columnas: on ? [...new Set([...prev.columnas, key])] : prev.columnas.filter((c) => c !== key),
    }));

  // Defensive: the value round-trips through unvalidated JSONB, so tolerate null/undefined.
  const logoValue = (c: LogoChoice) => (typeof c === 'string' ? c : c ? 'otro' : 'none');

  const logoFileRefs = {
    logoIzq: useRef<HTMLInputElement>(null),
    logoDer: useRef<HTMLInputElement>(null),
  };

  const onLogoSelect = (slot: 'logoIzq' | 'logoDer') => (v: string) => {
    if (v === 'otro') {
      // Open the file picker; keep the prior choice until a file actually lands.
      logoFileRefs[slot].current?.click();
      return;
    }
    set(slot, v as LogoChoice);
  };

  const onLogoFile = (slot: 'logoIzq' | 'logoDer') => async (e: ChangeEvent<HTMLInputElement>) => {
    setErr(null);
    const f = e.target.files?.[0];
    if (!f) return;
    // Clear the native input right away: no stale filename shown, and re-picking
    // the same file fires a fresh change event.
    e.target.value = '';
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
    set(slot, { dataUrl });
  };

  const generar = async () => {
    setErr(null);
    setWarn(null);
    let Wmm: number, Hmm: number;
    if (a.papel === 'custom') {
      if (!a.customWmm || !a.customHmm || a.customWmm <= 0 || a.customHmm <= 0) {
        setErr('Indica ancho y alto válidos.');
        return;
      }
      Wmm = a.customWmm;
      Hmm = a.customHmm;
    } else {
      [Wmm, Hmm] = PRINT_PAPERS[a.papel];
    }
    if (Wmm < Hmm) [Wmm, Hmm] = [Hmm, Wmm]; // siempre horizontal
    const marginMM = Math.max(0, Math.min(40, a.margenMM || 0));
    if (Wmm - 2 * marginMM < 20 || Hmm - 2 * marginMM < 20) {
      setErr('Margen demasiado grande para el papel.');
      return;
    }

    // Normalize what gets printed AND persisted, so a reopen shows exactly what printed.
    const norm: AjustesImpresion = {
      ...a,
      margenMM: marginMM,
      paginasAncho: Math.max(1, Math.min(12, Math.round(a.paginasAncho || 1))),
      maxPaginasAlto: Math.max(0, Math.round(a.maxPaginasAlto || 0)),
    };
    setA(norm);

    // Server caps the stored JSON at 600 KB; check with headroom up front so the failure is
    // actionable BEFORE printing (two ~350 KB logos pass the per-file cap but not the total).
    if (new TextEncoder().encode(JSON.stringify(norm)).length > 550 * 1024) {
      setErr('Los logos suman demasiado (máx. ~550 KB en total). Usa imágenes más livianas.');
      return;
    }

    setBusy(true);
    try {
      let logoLeft: string | null = null;
      let logoRight: string | null = null;
      let logoFailed = false;
      try {
        [logoLeft, logoRight] = await Promise.all([resolveLogo(norm.logoIzq), resolveLogo(norm.logoDer)]);
      } catch {
        logoFailed = true;
      }
      const todayStr = new Date().toISOString().slice(0, 10);
      const { rangeStart, totalDays } = computeChartRange(computed.schedule, config.startDate, todayStr);
      const opts: PrintOptions = {
        Wmm, Hmm, marginMM,
        fontKey: norm.letra,
        pagesWide: norm.paginasAncho,
        maxTall: norm.maxPaginasAlto,
        shrinkToFit: norm.reducirLetra,
        visibleCols: norm.columnas,
        title: norm.titulo.trim() || config.name,
        subtitle: norm.subtitulo.trim(),
        logoLeft, logoRight,
      };
      const data: PrintData = {
        rows,
        schedule: computed.schedule,
        rollup: computed.rollup,
        critical: showCritical ? computed.critical : null,
        violations: computed.violations,
        baselineBars: (config.baseline as { bars?: Record<string, { s: string; f: string }> } | null)?.bars ?? null,
        cycle: computed.cycle,
        todayStr, rangeStart, totalDays,
        rowNum: fullRowNum,
      };
      const { pages, layout } = buildPrintPages(opts, data);
      if (layout.errTableTooWide) {
        setErr('La tabla no cabe a lo ancho: usa letra más pequeña, menos columnas o papel más grande.');
        return;
      }
      if (!openPrintWindow(pages, { Wmm, Hmm, marginMM, docTitle: opts.title })) {
        setErr('El navegador bloqueó la ventana de impresión — permite ventanas emergentes para este sitio.');
        return;
      }
      // The print window is already open; awaiting the save only delays the dialog close a
      // moment so a failure can actually be SEEN (a warn set after close would be lost).
      let saveFailed = false;
      try {
        await saveAjustesImpresion(config.id, norm);
        onSavedAjustes(norm, config.id);
      } catch {
        saveFailed = true;
        setWarn('No se pudieron guardar los ajustes de impresión (el PDF no se afecta).');
      }
      if (logoFailed) setWarn('No se pudo cargar un logo; se imprimió sin él.');
      if (layout.warn) setWarn(layout.warn);
      if (!layout.warn && !logoFailed && !saveFailed) onOpenChange(false);
    } catch (e) {
      console.error('Error generando PDF de cronograma:', e);
      setErr('No se pudo generar el PDF; intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const logoSlot = (slot: 'logoIzq' | 'logoDer', label: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={logoValue(a[slot])} onValueChange={onLogoSelect(slot)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pinellas">Pinellas</SelectItem>
          <SelectItem value="cocp">COCP</SelectItem>
          <SelectItem value="none">Ninguno</SelectItem>
          <SelectItem value="otro">Otra imagen…</SelectItem>
        </SelectContent>
      </Select>
      {a[slot] && typeof a[slot] === 'object' && (
        <p className="text-xs text-muted-foreground">Imagen personalizada guardada.</p>
      )}
      <Input ref={logoFileRefs[slot]} type="file" accept="image/*" onChange={onLogoFile(slot)} className="text-xs" />
    </div>
  );

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="standard"
      title="Imprimir / PDF"
      description="Genera el cronograma listo para imprimir o guardar como PDF (escala 100%)."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={generar} disabled={busy}>{busy ? 'Generando…' : 'Generar PDF'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Tamaño de papel</Label>
            <Select value={a.papel} onValueChange={(v) => set('papel', v as AjustesImpresion['papel'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="letter">Carta</SelectItem>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="a3">A3</SelectItem>
                <SelectItem value="tabloid">Tabloide</SelectItem>
                <SelectItem value="custom">Personalizado…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Margen (mm)</Label>
            <Input type="number" min={0} max={40} step={1} className="tabular-nums" value={a.margenMM}
              onChange={(e) => set('margenMM', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tamaño de letra</Label>
            <Select value={a.letra} onValueChange={(v) => set('letra', v as AjustesImpresion['letra'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="grande">Grande</SelectItem>
                <SelectItem value="extra">Extra</SelectItem>
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

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Páginas de ancho</Label>
            <Input type="number" min={1} max={12} step={1} className="tabular-nums" value={a.paginasAncho}
              onChange={(e) => set('paginasAncho', parseInt(e.target.value, 10) || 1)} />
          </div>
          <div className="space-y-1.5">
            <Label>Máx. páginas de alto (0 = auto)</Label>
            <Input type="number" min={0} step={1} className="tabular-nums" value={a.maxPaginasAlto}
              onChange={(e) => set('maxPaginasAlto', parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Checkbox id="print-shrink" checked={a.reducirLetra}
              onCheckedChange={(v) => set('reducirLetra', v === true)} />
            <Label htmlFor="print-shrink" className="text-sm font-normal leading-tight">
              Reducir la letra si hace falta
            </Label>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Columnas</Label>
          <div className="flex flex-wrap gap-4">
            {COLUMN_OPTIONS.map((c) => (
              <label key={c.key} className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={a.columnas.includes(c.key)}
                  onCheckedChange={(v) => toggleCol(c.key, v === true)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={a.titulo} placeholder={config.name}
              onChange={(e) => set('titulo', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Subtítulo</Label>
            <Input value={a.subtitulo} placeholder="p. ej. Cronograma maestro — Para revisión"
              onChange={(e) => set('subtitulo', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {logoSlot('logoIzq', 'Logo izquierdo')}
          {logoSlot('logoDer', 'Logo derecho')}
        </div>

        {err && <Alert variant="error" title={err} />}
        {warn && <Alert variant="warning" title={warn} />}
      </div>
    </AppDialog>
  );
}
