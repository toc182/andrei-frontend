/**
 * Quién aprueba las requisiciones de un proyecto, y con qué número arrancan.
 *
 * Vive en Personal del proyecto, debajo de los aprobadores de pagos: son las
 * mismas personas del proyecto (Ivan, 2026-10-02). Una sola persona aprueba,
 * no una cadena. El número inicial existe porque las obras ya traen su cuenta en
 * papel (Santa Isabel iba por la 174): después de la primera requisición del
 * sistema ya no cambia nada, y el servidor no lo deja bajar.
 */
import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import api from '@/services/api';
import { AppDialog, Alert } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Ajustes {
  aprobador_id: number | null;
  aprobador_nombre: string | null;
  numero_inicial: number;
  prefijo: string | null;
  ultima: number | null;
  siguiente: string | null;
}

interface Props {
  proyectoId: number;
  /** Las personas del proyecto que pueden aprobar: usuarios internos que son miembros. */
  candidatos: { id: number; nombre: string }[];
}

const NADIE = 'nadie';

export default function AjustesRequisiciones({ proyectoId, candidatos }: Props) {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [aprobador, setAprobador] = useState(NADIE);
  const [inicial, setInicial] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const traer = useCallback(() => {
    api
      .get(`/requisiciones/proyecto/${proyectoId}/ajustes`)
      .then((res) => setAjustes(res.data.data as Ajustes))
      .catch(() => setAjustes(null));
  }, [proyectoId]);
  useEffect(() => traer(), [traer]);

  const abrir = () => {
    setAprobador(ajustes?.aprobador_id ? String(ajustes.aprobador_id) : NADIE);
    setInicial(String(ajustes?.numero_inicial ?? 1));
    setError(null);
    setAbierto(true);
  };

  const yaArranco = (ajustes?.ultima ?? 0) > 0;
  const n = Number(inicial);
  const siguiente =
    ajustes?.prefijo && Number.isInteger(n) && n >= 1
      ? `REQ-${ajustes.prefijo}-${String(Math.max(n, (ajustes.ultima ?? 0) + 1)).padStart(3, '0')}`
      : null;

  const guardar = async () => {
    const cuerpo: Record<string, unknown> = {
      aprobador_id: aprobador === NADIE ? null : Number(aprobador),
    };
    if (!yaArranco) {
      if (!Number.isInteger(n) || n < 1) {
        setError('El número de la primera es un entero mayor que cero');
        return;
      }
      cuerpo.numero_inicial = n;
    }
    setGuardando(true);
    try {
      await api.put(`/requisiciones/proyecto/${proyectoId}/ajustes`, cuerpo);
      setAbierto(false);
      traer();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  // El que aprueba hoy, aunque ya no sea miembro, sigue en la lista para que se
  // vea quién es y se pueda cambiar.
  const opciones =
    ajustes?.aprobador_id && !candidatos.some((c) => c.id === ajustes.aprobador_id)
      ? [...candidatos, { id: ajustes.aprobador_id, nombre: ajustes.aprobador_nombre ?? '—' }]
      : candidatos;

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Requisiciones</h3>
        <Button variant="outline" size="sm" onClick={abrir} disabled={!ajustes}>
          <Settings className="mr-2 h-4 w-4" />
          Configurar
        </Button>
      </div>
      <div className="flex items-center gap-2 rounded bg-muted/50 p-2 text-sm">
        <span className="w-28 text-muted-foreground">Las aprueba</span>
        <span className="font-medium">{ajustes?.aprobador_nombre ?? 'Nadie todavía'}</span>
      </div>

      <AppDialog
        open={abierto}
        onOpenChange={(v) => !guardando && setAbierto(v)}
        size="simple"
        title="Configurar requisiciones"
        description="Quién aprueba las requisiciones del proyecto, con su contraseña"
        footer={
          <>
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert variant="error" title={error} />}
          <div>
            <Label>Quién las aprueba</Label>
            <Select value={aprobador} onValueChange={setAprobador}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NADIE}>Nadie</SelectItem>
                {opciones.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="req-inicial">Número de la primera</Label>
            <Input
              id="req-inicial"
              value={inicial}
              onChange={(e) => setInicial(e.target.value.replace(/\D/g, ''))}
              disabled={yaArranco}
              inputMode="numeric"
              className="mt-1 w-36 text-right tabular-nums"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {yaArranco
                ? `Ya hay requisiciones hasta la ${ajustes?.ultima}: la cuenta sigue sola.`
                : siguiente
                  ? `La próxima será ${siguiente}. Después de la primera ya no se cambia.`
                  : 'Configure el prefijo del proyecto para numerarlas.'}
            </p>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
