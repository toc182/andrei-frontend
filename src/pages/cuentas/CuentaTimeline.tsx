import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { CuentaEvento } from '@/types/api';
import api from '@/services/api';

interface Props {
  cuentaId: number;
  eventos: CuentaEvento[];
  onChanged: () => void;
}

const TYPE_STYLES: Record<string, { dot: string; badge: string; badgeBg: string; label: string }> = {
  creacion: { dot: 'border-teal', badge: 'text-teal', badgeBg: 'bg-teal/10', label: 'Inicio' },
  transicion: { dot: 'border-info', badge: 'text-info', badgeBg: 'bg-info/10', label: 'Estado' },
  comentario: { dot: 'border-slate-300', badge: 'text-slate-600', badgeBg: 'bg-slate-50', label: 'Actualización' },
  edicion: { dot: 'border-warning', badge: 'text-warning', badgeBg: 'bg-warning/10', label: 'Edición' },
};

function formatTimestamp(s: string): string {
  const d = new Date(s);
  const dd = String(d.getDate()).padStart(2, '0');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${months[d.getMonth()]}/${d.getFullYear()} · ${hh}:${mm}`;
}

export default function CuentaTimeline({ cuentaId, eventos, onChanged }: Props) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const postUpdate = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.post(`/cuentas/${cuentaId}/comentario`, { comentario: text });
      setText('');
      onChanged();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      {/* Timeline */}
      <div className="relative pl-6">
        {eventos.map((ev, i) => {
          const style = TYPE_STYLES[ev.tipo] || TYPE_STYLES.comentario;
          const isLast = i === eventos.length - 1;
          return (
            <div key={ev.id} className="relative pb-5 last:pb-0">
              {/* Dot */}
              <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white ${style.dot}`} />
              {/* Connector line to next event */}
              {!isLast && (
                <div className="absolute -left-[17px] top-5 -bottom-1 w-0.5 bg-border" />
              )}

              {/* Meta */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-medium">{ev.creado_por_nombre}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${style.badgeBg} ${style.badge}`}>
                  {style.label}
                </span>
                <span className="text-xs text-muted-foreground">{formatTimestamp(ev.created_at)}</span>
              </div>

              {/* Content */}
              <div className="text-sm text-muted-foreground leading-relaxed">
                {ev.tipo === 'transicion' && (
                  <span>
                    {ev.estado_desde} → <strong className="text-foreground">{ev.estado_hacia}</strong>
                  </span>
                )}
                {ev.comentario && (
                  <span className={ev.tipo === 'transicion' ? 'block mt-1' : ''}>
                    {ev.comentario}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add update */}
      <div className="mt-4">
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Agregar actualización..."
            rows={2}
            className="flex-1 text-sm"
          />
          <Button onClick={postUpdate} disabled={!text.trim() || posting} size="sm" className="self-end">
            {posting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
