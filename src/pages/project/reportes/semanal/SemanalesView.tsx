/**
 * La pestaña «Semanales» de Reportes: decide qué se ve —la lista, el formulario
 * o un reporte ya enviado— igual que ProjectReportes hace con los diarios.
 *
 * Cuando se abre el formulario o un reporte, la pantalla se la queda entera:
 * `onPantallaCompleta` se lo dice a la página para que esconda su cabecera y
 * sus pestañas, como pasa con el reporte diario.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import api from '@/services/api';
import { ErrorState, PageHeader, TableSkeleton } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { toast } from 'sonner';
import ListaSemanales from './ListaSemanales';
import SemanalDetalle from './SemanalDetalle';
import SemanalForm from './SemanalForm';
import type { SemanaDisponible, SemanalFila } from './tipos';

type Vista =
  | { modo: 'lista' }
  | { modo: 'form'; id: number }
  | { modo: 'detalle'; id: number };

export default function SemanalesView({
  projectId, onPantallaCompleta,
}: {
  projectId: number;
  onPantallaCompleta: (completa: boolean) => void;
}) {
  const [vista, setVista] = useState<Vista>({ modo: 'lista' });
  const [filas, setFilas] = useState<SemanalFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [titulo, setTitulo] = useState<string | null>(null);
  const [bajando, setBajando] = useState<number | null>(null);

  // El PDF se pide con el token puesto y se abre desde memoria: un enlace pelado
  // llegaría sin autenticación y el servidor lo rechazaría. Mismo camino que en
  // los reportes diarios.
  const descargarPdf = async (id: number) => {
    setBajando(id);
    try {
      const r = await api.get(`/proyecto-reportes-semanales/${projectId}/${id}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setBajando(null);
    }
  };

  const cargar = useCallback(() => {
    setCargando(true);
    setError(false);
    api
      .get(`/proyecto-reportes-semanales/${projectId}`)
      .then((r) => setFilas(r.data.data ?? []))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [projectId]);

  useEffect(() => {
    if (vista.modo === 'lista') cargar();
  }, [vista.modo, cargar]);

  useEffect(() => {
    onPantallaCompleta(vista.modo !== 'lista');
  }, [vista.modo, onPantallaCompleta]);

  /**
   * «Nuevo reporte semanal»: abre la última semana que tiene reportes diarios y
   * todavía no tiene semanal. Si esa semana ya tiene un borrador empezado, se
   * sigue ese mismo; no se abre otro.
   */
  const nuevo = async () => {
    setAbriendo(true);
    try {
      const r = await api.get(`/proyecto-reportes-semanales/${projectId}/semanas`);
      const semanas = (r.data.data ?? []) as SemanaDisponible[];
      if (semanas.length === 0) {
        toast.error('No hay ninguna semana con reportes diarios sin reportar');
        return;
      }
      const creado = await api.post(`/proyecto-reportes-semanales/${projectId}`, {
        fecha: semanas[0].semana_inicio,
      });
      setVista({ modo: 'form', id: creado.data.data.id as number });
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      toast.error(msg ?? 'No se pudo empezar el reporte');
    } finally {
      setAbriendo(false);
    }
  };

  if (vista.modo === 'detalle') {
    return (
      <SemanalDetalle
        projectId={projectId}
        reporteId={vista.id}
        onVolver={() => setVista({ modo: 'lista' })}
        onPdf={() => descargarPdf(vista.id)}
        bajandoPdf={bajando === vista.id}
      />
    );
  }

  if (vista.modo === 'form') {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVista({ modo: 'lista' })}
            aria-label="Volver a reportes"
            className="-ml-2 h-8 w-8 shrink-0 self-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader title="Nuevo reporte semanal" subtitle={titulo ?? undefined} />
        </div>
        <SemanalForm
          projectId={projectId}
          reporteId={vista.id}
          onCambiarReporte={(id) => setVista({ modo: 'form', id })}
          onCabecera={setTitulo}
          onListo={() => setVista({ modo: 'lista' })}
          onCancelar={() => setVista({ modo: 'lista' })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={nuevo} disabled={abriendo}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo reporte semanal
        </Button>
      </div>

      {error ? (
        <ErrorState onRetry={cargar} />
      ) : cargando ? (
        <Card className="overflow-hidden p-0">
          <Table><TableSkeleton rows={4} columns={5} /></Table>
        </Card>
      ) : (
        <ListaSemanales
          filas={filas}
          onAbrir={(id) => setVista({ modo: 'detalle', id })}
          onNuevo={nuevo}
          onPdf={descargarPdf}
          bajando={bajando}
        />
      )}
    </div>
  );
}
