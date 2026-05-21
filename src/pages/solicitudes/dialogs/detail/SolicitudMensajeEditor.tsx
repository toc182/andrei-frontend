// Editable "mensaje" section shown inside SolicitudDetailDialog.
// One short editable note per solicitud. Anyone with access can edit;
// last writer wins. The top-of-dialog banner shows the saved mensaje
// (read-only); this section is the writer for it.

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/shell/Alert';
import {
  saveMensajeSolicitud,
  type MensajeUpdated,
} from '../../utils/solicitudActions';

interface SolicitudMensajeEditorProps {
  solicitudId: number;
  initialMensaje: string | null;
  onSaved: (updated: MensajeUpdated | null) => void;
}

export function SolicitudMensajeEditor({
  solicitudId,
  initialMensaje,
  onSaved,
}: SolicitudMensajeEditorProps) {
  const [mensaje, setMensaje] = useState(initialMensaje ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync when the underlying solicitud changes (e.g. switching rows).
  useEffect(() => {
    setMensaje(initialMensaje ?? '');
    setError(null);
  }, [initialMensaje, solicitudId]);

  const previo = (initialMensaje ?? '').trim();
  const actual = mensaje.trim();
  const dirty = actual !== previo;

  const handleSave = async () => {
    setError(null);
    await saveMensajeSolicitud({
      solicitudId,
      mensaje: actual || null,
      setSaving,
      onSuccess: (updated) => {
        onSaved(updated);
        toast.success(updated ? 'Mensaje guardado' : 'Mensaje eliminado');
      },
      onError: setError,
    });
  };

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
      <h4 className="font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" /> Mensaje
      </h4>
      <Textarea
        rows={2}
        maxLength={1000}
        placeholder="Escribe un mensaje corto sobre esta solicitud..."
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        disabled={saving}
      />
      {error && <Alert variant="error" title={error} />}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}
