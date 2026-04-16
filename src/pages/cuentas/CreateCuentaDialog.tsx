import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import api from '@/services/api';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: number;
  onCreated: () => void;
}

export default function CreateCuentaDialog({ open, onOpenChange, projectId, onCreated }: Props) {
  const [monto, setMonto] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [avance, setAvance] = useState('');
  const [esFinal, setEsFinal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMonto('');
      setPeriodoInicio('');
      setPeriodoFin('');
      setAvance('');
      setEsFinal(false);
      setError('');
    }
  }, [open]);

  const submit = async () => {
    setError('');
    if (!monto) { setError('Monto es requerido'); return; }
    setSaving(true);
    try {
      await api.post('/cuentas', {
        proyecto_id: projectId,
        monto_total: Number(monto),
        periodo_inicio: periodoInicio || undefined,
        periodo_fin: periodoFin || undefined,
        avance_porcentaje: avance ? Number(avance) : undefined,
        es_final: esFinal,
      });
      onCreated();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Error al crear cuenta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Cuenta</DialogTitle>
          <DialogDescription>La cuenta se creará como borrador.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Monto total (B/.)</Label>
            <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periodo inicio</Label>
              <Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
            </div>
            <div>
              <Label>Periodo fin</Label>
              <Input type="date" value={periodoFin} onChange={(e) => setPeriodoFin(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Avance (%)</Label>
            <Input type="number" step="0.01" min="0" max="100" value={avance} onChange={(e) => setAvance(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={esFinal} onChange={(e) => setEsFinal(e.target.checked)} />
            Cuenta Final
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
