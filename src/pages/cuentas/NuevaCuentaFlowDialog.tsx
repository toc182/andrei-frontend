// Flujo de "Nueva cuenta" en UN solo dialog con dos pasos: elegir tipo
// (Sencilla / Completa) y, si es Completa, elegir el desglose. Mantener el
// mismo AppDialog montado hace que el contenido cambie en el sitio, sin el
// parpadeo de cerrar un modal y abrir otro.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/shell/DatePicker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronRight, FileText, Table2, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/shell';
import { getDesglosesCuentas, type DesgloseCuenta } from '@/lib/desgloseApi';
import { crearCuentaDetalle } from '@/lib/cuadroApi';

type Step = 'tipo' | 'desglose' | 'fin';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: number;
  initialStep?: Step;
  /** Desglose ya elegido por el proyecto: se salta el paso de elegirlo. */
  desgloseEnUso?: number | null;
  /** Fin de la cuenta anterior; con él se explica dónde arranca esta. */
  finAnterior?: string | null;
  onManual: () => void;
  onCreated: (cuentaId: number) => void;
  onIrADesgloses: () => void;
}

export default function NuevaCuentaFlowDialog({
  open,
  onOpenChange,
  projectId,
  initialStep = 'tipo',
  desgloseEnUso,
  finAnterior,
  onManual,
  onCreated,
  onIrADesgloses,
}: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [desgloses, setDesgloses] = useState<DesgloseCuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /** El fin del periodo es obligatorio: sin él la cuenta siguiente no sabría
   *  cuándo empieza. El inicio no se pregunta — lo calcula el servidor. */
  const [fin, setFin] = useState('');

  // Altura animada del contenido: al cambiar de paso el recuadro crece/encoge
  // suave en vez de saltar (el dialog está centrado y recolocarse se nota).
  // Ref callback (no useRef): Radix desmonta el contenido al cerrar, así que
  // re-mide en cada apertura — evita quedarse con una altura vieja (o 0) que
  // recortaría el contenido al reabrir.
  const roRef = useRef<ResizeObserver | null>(null);
  const [contentH, setContentH] = useState<number>();
  const setContentNode = useCallback((node: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!node) return;
    const update = () => setContentH(node.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    roRef.current = ro;
  }, []);

  // Al abrir, arranca en el paso pedido.
  useEffect(() => {
    if (open) setStep(initialStep);
  }, [open, initialStep]);

  // Precarga los desgloses al abrir (así el paso "desglose" no muestra spinner).
  useEffect(() => {
    if (!open) return;
    setSelected('');
    setError('');
    setFin('');
    setLoading(true);
    getDesglosesCuentas(projectId)
      .then((d) => {
        setDesgloses(d);
        if (d.length === 1) setSelected(String(d[0].id));
      })
      .catch(() => setError('No se pudieron cargar los desgloses'))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const desgloseId = desgloseEnUso ?? Number(selected);

  const crear = async () => {
    if (!desgloseId || !fin) return;
    setSaving(true);
    setError('');
    try {
      const { id } = await crearCuentaDetalle({
        proyecto_id: projectId,
        desglose_id: desgloseId,
        periodo_fin: fin,
      });
      onCreated(id);
    } catch {
      setError('No se pudo crear la cuenta');
      setSaving(false);
    }
  };

  const sinDesgloses = step === 'desglose' && !loading && desgloses.length === 0;

  const title = step === 'tipo' ? 'Nueva cuenta' : 'Nueva cuenta con desglose';
  const description =
    step === 'tipo'
      ? 'Elige cómo se llevarán las cuentas de este proyecto. Queda fijo; cambiar de tipo después implica borrar las cuentas.'
      : step === 'fin'
        ? 'Hasta qué fecha llega esta cuenta.'
        : sinDesgloses
          ? undefined
          : 'Elige el desglose con el que se arma la cuenta. Se copian sus filas y registras el avance por fila.';

  const footer =
    step === 'fin' ? (
      <>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={crear} disabled={!fin || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear cuenta
        </Button>
      </>
    ) : step === 'desglose' && !sinDesgloses ? (
      <>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={() => setStep('fin')} disabled={!selected}>
          Continuar
        </Button>
      </>
    ) : undefined;

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="simple"
      title={title}
      description={description}
      footer={footer}
    >
      <div className="overflow-hidden transition-[height] duration-200 ease-out" style={{ height: contentH || undefined }}>
        <div ref={setContentNode}>
      {step === 'fin' ? (
        <div className="space-y-2">
          <Label>Fin del periodo</Label>
          <DatePicker value={fin} onChange={setFin} />
          <p className="text-xs text-muted-foreground">
            {finAnterior
              ? 'Empieza al día siguiente del fin de la cuenta anterior.'
              : 'Empieza el día de la Orden de Proceder del proyecto.'}
          </p>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      ) : step === 'tipo' ? (
        <div className="grid auto-rows-fr gap-3">
          <button
            type="button"
            onClick={onManual}
            className="flex w-full items-center gap-3 rounded-lg border border-border border-l-4 border-l-navy p-4 text-left transition-colors hover:bg-muted/40"
          >
            <Table2 className="h-5 w-5 shrink-0 text-navy" />
            <div className="flex-1">
              <div className="font-semibold">Sencilla</div>
              <p className="text-sm text-muted-foreground">Escribes el monto de cada cuenta directamente. Lo más simple.</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => setStep('desglose')}
            className="flex w-full items-center gap-3 rounded-lg border border-border border-l-4 border-l-teal p-4 text-left transition-colors hover:bg-muted/40"
          >
            <FileText className="h-5 w-5 shrink-0 text-teal" />
            <div className="flex-1">
              <div className="font-semibold">Completa</div>
              <p className="text-sm text-muted-foreground">Armas un cuadro por partidas y registras el avance por fila.</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Cargando desgloses...
        </div>
      ) : sinDesgloses ? (
        <EmptyState
          icon={FileText}
          title="Aún no hay desgloses"
          description="Primero crea un desglose con las partidas y precios; después armas la cuenta a partir de él."
          action={<Button onClick={onIrADesgloses}>Nuevo Desglose</Button>}
        />
      ) : (
        <>
          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2">
            {desgloses.map((d) => (
              <label
                key={d.id}
                htmlFor={`desg-${d.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40 has-[:checked]:border-navy has-[:checked]:bg-navy/[0.04]"
              >
                <RadioGroupItem id={`desg-${d.id}`} value={String(d.id)} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{d.descripcion}</div>
                  {d.fecha && <div className="text-xs text-muted-foreground tabular-nums">{d.fecha}</div>}
                </div>
              </label>
            ))}
          </RadioGroup>
          {error && <p className="mt-3 text-sm text-error">{error}</p>}
        </>
      )}
        </div>
      </div>
    </AppDialog>
  );
}
