// AsistentePagos — pedirle los cambios hablando.
//
// Vive al lado de la tabla de Pagos. Escribes una frase, el asistente propone,
// y los cambios se marcan sobre las filas de la tabla de al lado — no aqui.
// Este panel es la conversacion; la propuesta se mira donde estan los datos.
//
// No guarda nada. Lo unico que escribe es el boton de aplicar, que vive en la
// barra de arriba de la tabla.

import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/shell';
import { cn } from '@/lib/utils';
import {
  conversarAsistente, type MensajeChat, type Propuesta,
} from '@/lib/asistentePagosApi';

const EJEMPLOS = [
  'los pagos de Cemento repártelos entre el cajón pluvial y las cunetas, mitad y mitad',
  'todo lo de combustible a conformación de calzada',
  '¿qué pagos me quedan sin partida?',
];

interface AsistentePagosProps {
  projectId: number;
  /** La propuesta que hay ahora en pantalla, para que el asistente sepa de que
   *  se le habla cuando pides corregirla. */
  propuesta: Propuesta | null;
  onPropuesta: (p: Propuesta | null) => void;
}

export default function AsistentePagos({
  projectId, propuesta, onPropuesta,
}: AsistentePagosProps) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, pensando]);

  const enviar = async (frase: string) => {
    const limpio = frase.trim();
    if (!limpio || pensando) return;

    const conMio: MensajeChat[] = [...mensajes, { rol: 'usuario', texto: limpio }];
    setMensajes(conMio);
    setTexto('');
    setError(null);
    setAviso(null);
    setPensando(true);

    try {
      const r = await conversarAsistente(projectId, conMio, propuesta);
      setMensajes([...conMio, { rol: 'asistente', texto: r.mensaje }]);
      if (r.aviso) setAviso(r.aviso);
      // Solo pisa lo que hay en pantalla si esta vuelta propuso algo. Una
      // pregunta de lectura no debe borrar la propuesta que estabas mirando.
      if (r.propuesta) onPropuesta(r.propuesta);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'No se pudo hablar con el asistente.');
      setMensajes(conMio);
    } finally {
      setPensando(false);
    }
  };

  return (
    <Card className="flex max-h-[min(640px,calc(100vh-2rem))] flex-col overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Sparkles className="h-4 w-4 text-teal" />
        <h3 className="text-sm font-semibold">Asistente de partidas</h3>
      </div>

      <div className="min-h-[220px] flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {mensajes.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Dile a qué partida va un grupo de pagos y te lo deja marcado en la tabla.
              Nada se guarda hasta que tú apliques.
            </p>
            <div className="space-y-1.5">
              {EJEMPLOS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => enviar(e)}
                  className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
              m.rol === 'usuario'
                ? 'ml-auto rounded-br-sm bg-primary text-primary-foreground'
                : 'mr-auto rounded-bl-sm bg-muted text-foreground',
            )}
          >
            {m.texto}
          </div>
        ))}

        {pensando && (
          <div className="mr-auto rounded-lg rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
            Pensando…
          </div>
        )}

        {aviso && <Alert variant="warning" title={aviso} />}
        {error && <Alert variant="error" title={error} />}

        <div ref={finRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border px-4 py-3">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter hace un salto de linea.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar(texto);
            }
          }}
          placeholder="Escribe lo que quieras cambiar…"
          rows={2}
          className="min-h-0 resize-none text-sm"
          disabled={pensando}
        />
        <Button
          size="icon"
          className="shrink-0"
          onClick={() => enviar(texto)}
          disabled={pensando || texto.trim().length === 0}
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
