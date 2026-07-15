// "Pegar desde Excel" dialog — paste a desglose range and preview it as a tree
// before appending anything to the editor. Reads only; parseDesglosePaste does
// all the real work (hierarchy detection, totals, mismatch flags) — this
// component just renders the live preview and hands the parsed rows back to
// the caller on confirm. Nothing touches the server here; the parent decides
// when (and whether) to save.

import { useMemo, useState } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { parseDesglosePaste, type DesglosePasteMode } from '@/lib/desglosePaste';
import type { DesgloseRow } from '@/lib/desgloseModel';

interface DesglosePasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the parsed rows (tempIds start at 1 — remapping them to be
   *  unique against the existing editor rows is the PARENT's job). */
  onConfirm: (rows: DesgloseRow[]) => void;
}

// Depth padding classes — Tailwind requires literal class names (no dynamic
// `pl-${n}` strings), so this is a lookup table. Clamp the index for any
// depth beyond what the scale covers.
const PAD = ['pl-0', 'pl-4', 'pl-8', 'pl-12', 'pl-16', 'pl-20', 'pl-24', 'pl-28', 'pl-32'];
const padClass = (depth: number) => PAD[Math.min(depth, PAD.length - 1)];

// Preview renders at most this many rows (huge pastes would freeze the
// dialog); Confirmar still inserts ALL parsed rows.
const PREVIEW_CAP = 200;

export function DesglosePasteDialog({ open, onOpenChange, onConfirm }: DesglosePasteDialogProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<DesglosePasteMode>('codigos');

  const parsed = useMemo(() => parseDesglosePaste(text, mode), [text, mode]);
  const count = parsed.rows.length;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setText('');
      setMode('codigos');
    }
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (count === 0) return;
    // Strip the preview-only totalMismatch flag — DesgloseRow doesn't carry it.
    const rows: DesgloseRow[] = parsed.rows.map(({ totalMismatch: _totalMismatch, ...r }) => r);
    onConfirm(rows);
    handleOpenChange(false);
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="complex"
      title="Pegar desde Excel"
      description="Pega filas copiadas de Excel y revisa la vista previa antes de agregarlas."
      footer={
        <>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={count === 0}>
            {`Confirmar (${count} fila${count === 1 ? '' : 's'})`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Pega aquí las filas copiadas de Excel — columnas: item, descripción, unidad, cantidad, precio unitario, total (opcional)"
        />

        <div className="space-y-1.5">
          <Label>Niveles</Label>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as DesglosePasteMode)}
            className="grid-flow-col auto-cols-max gap-6"
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="codigos" id="paste-mode-codigos" />
              Detectar niveles por código de item
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="plano" id="paste-mode-plano" />
              Todo plano
            </label>
          </RadioGroup>
        </div>

        {parsed.skippedHeader && (
          <p className="text-xs text-muted-foreground">Encabezado omitido</p>
        )}

        <div className="space-y-1.5">
          <Label>Vista previa</Label>
          {count === 0 ? (
            <p className="text-sm text-muted-foreground">Pega filas arriba para ver la vista previa.</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {parsed.rows.slice(0, PREVIEW_CAP).map((r) => (
                <div key={r.tempId} className={`flex items-center gap-2 py-0.5 text-sm ${padClass(r.depth)}`}>
                  {r.item && <span className="text-muted-foreground">{r.item}</span>}
                  <span className={r.tipo === 'grupo' ? 'font-semibold' : ''}>
                    {r.descripcion || <span className="text-muted-foreground">(sin descripción)</span>}
                  </span>
                  {r.tipo === 'grupo' && (
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 border">grupo</Badge>
                  )}
                  {r.totalMismatch && (
                    <Badge className="bg-warning/10 text-warning border-warning/30 border">
                      total ≠ cant×PU
                    </Badge>
                  )}
                  {r.tipo === 'item' && (
                    <span className="ml-auto flex items-center gap-3 tabular-nums text-muted-foreground">
                      {r.unidad && <span>{r.unidad}</span>}
                      {r.cantidad != null && <span>{r.cantidad}</span>}
                      {r.precioUnitario != null && <span>{r.precioUnitario}</span>}
                    </span>
                  )}
                </div>
              ))}
              {count > PREVIEW_CAP && (
                <p className="py-0.5 text-xs text-muted-foreground">
                  …y {count - PREVIEW_CAP} filas más
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AppDialog>
  );
}
