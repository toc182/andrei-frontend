// NuevoPresupuestoDialog — crear un presupuesto, en dos pasos dentro del mismo
// cuadro: primero de que manera se arma y despues como se llama. Mantener el
// mismo AppDialog montado hace que el contenido cambie en el sitio, sin el
// parpadeo de cerrar uno y abrir otro (precedente: NuevaCuentaFlowDialog).
//
// Dos maneras vivas: "desde el desglose del proyecto", que solo sirve si el
// proyecto tiene uno —si no, la tarjeta sale apagada y lo dice—, y "desde
// cero", que sirve siempre y es la unica salida de un proyecto sin desglose.

import { useEffect, useState } from 'react';
import { ChevronRight, FileText, Loader2, Table2 } from 'lucide-react';
import { AppDialog } from '@/components/shell/AppDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  crearPresupuesto, type DesgloseDisponible, type PresupuestoMeta,
} from '@/lib/presupuestoApi';

type Paso = 'como' | 'nombre';
type Manera = 'desglose' | 'cero';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: number;
  /** El desglose oficial del proyecto; null = no hay de donde partir. */
  desglose: DesgloseDisponible | null;
  /** Viaja el presupuesto recien creado entero, no solo su id: quien abre la
   *  hoja necesita saber de que manera se armo —para pintar el editor que
   *  toca— y como se llama, y asi no tiene que volver a preguntarselo al
   *  servidor. */
  onCreado: (presupuesto: PresupuestoMeta) => void;
}

export default function NuevoPresupuestoDialog({
  open, onOpenChange, projectId, desglose, onCreado,
}: Props) {
  const [paso, setPaso] = useState<Paso>('como');
  const [manera, setManera] = useState<Manera>('desglose');
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre, vuelve al primer paso: reabrirlo y caer en el nombre
  // de un intento anterior se lee como que ya escogiste.
  useEffect(() => {
    if (open) {
      setPaso('como');
      setManera('desglose');
      setNombre('');
      setError(null);
    }
  }, [open]);

  const crear = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    try {
      setGuardando(true);
      setError(null);
      const doc = await crearPresupuesto(projectId, limpio, manera);
      onCreado(doc.presupuesto);
      onOpenChange(false);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'No se pudo crear el presupuesto.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="simple"
      title={paso === 'como' ? '¿Cómo armas el presupuesto?' : '¿Cómo se llama este presupuesto?'}
      description={
        paso === 'como'
          ? 'Escoge una manera y la hoja nace lista para llenar.'
          : manera === 'desglose'
            ? 'Se arma con los renglones del desglose del proyecto.'
            : 'La hoja nace en blanco y tú escribes los renglones.'
      }
      footer={
        paso === 'nombre' ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={crear} disabled={!nombre.trim() || guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </>
        ) : undefined
      }
    >
      {paso === 'como' ? (
        <div className="grid auto-rows-fr gap-3">
          <button
            type="button"
            disabled={!desglose}
            onClick={() => { setManera('desglose'); setPaso('nombre'); }}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border border-border border-l-4 border-l-teal p-4 text-left transition-colors',
              desglose ? 'hover:bg-muted/40' : 'cursor-not-allowed opacity-50',
            )}
          >
            <FileText className="h-5 w-5 shrink-0 text-teal" />
            <div className="flex-1">
              <div className="font-semibold">Desde el desglose del proyecto</div>
              <p className="text-sm text-muted-foreground">
                {desglose
                  ? `Trae los ${desglose.filas} renglones del desglose con sus cantidades y precios. Tú solo escribes lo que te cuesta cada uno.`
                  : 'Este proyecto todavía no tiene desglose, así que no se puede armar de esta manera.'}
              </p>
            </div>
            {desglose && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </button>

          <button
            type="button"
            onClick={() => { setManera('cero'); setPaso('nombre'); }}
            className="flex w-full items-center gap-3 rounded-lg border border-border border-l-4 border-l-navy p-4 text-left transition-colors hover:bg-muted/40"
          >
            <Table2 className="h-5 w-5 shrink-0 text-navy" />
            <div className="flex-1">
              <div className="font-semibold">Desde cero</div>
              <p className="text-sm text-muted-foreground">
                La hoja nace en blanco y escribes tú los renglones, con sus grupos y sus
                costos. Es la única manera si el proyecto todavía no tiene desglose.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="nombre-presupuesto">Nombre</Label>
          <Input
            id="nombre-presupuesto"
            autoFocus
            value={nombre}
            maxLength={200}
            placeholder="Después de adjudicado"
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nombre.trim()) crear(); }}
          />
          <p className="text-xs text-muted-foreground">
            Ponle el momento en que lo estás haciendo: antes de la licitación, después de
            adjudicado, con los diseños listos.
          </p>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      )}
    </AppDialog>
  );
}
