import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';
import type { CajaMenudaDetail as CajaMenudaDetailType, CajaMenudaGasto, CajaMenudaAdjunto } from '../types/api';
import {
  Plus, Pencil, Trash2, Loader2, Upload, Download, FileText, Receipt, Send, AlertCircle, FileCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
// Dialog removed — using AppDialog from shell instead
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// Shell Components
import { PageHeader } from '@/components/shell/PageHeader';
import { AppDialog } from '@/components/shell/AppDialog';
import { Alert } from '@/components/shell/Alert';

// --- Zod schemas ---

const max2Decimals = (v: string) => {
  const parts = v.split('.');
  return parts.length < 2 || parts[1].length <= 2;
};

const gastoSchema = z.object({
  fecha: z.string().min(1, 'Fecha es obligatoria'),
  proveedor: z.string().min(1, 'Proveedor es obligatorio'),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  monto: z.string().min(1, 'Monto es obligatorio')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Monto debe ser mayor a 0')
    .refine(max2Decimals, 'Máximo 2 decimales'),
  itbms: z.string().optional()
    .refine((v) => !v || max2Decimals(v), 'Máximo 2 decimales'),
  monto_total: z.string().min(1, 'Total es obligatorio')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Total debe ser mayor a 0')
    .refine(max2Decimals, 'Máximo 2 decimales'),
});

type GastoFormData = z.infer<typeof gastoSchema>;

// --- Props ---

interface CajaMenudaDetailProps {
  cajaId: number;
  onBack: () => void;
}

// --- Helpers ---

const formatMonto = (valor: string | number | undefined) => {
  const num = Number(valor || 0);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string) => {
  const clean = dateStr.split('T')[0];
  const d = new Date(clean + 'T00:00:00');
  return d.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// --- Component ---

const CajaMenudaDetail = ({ cajaId, onBack }: CajaMenudaDetailProps) => {
  // State
  const [caja, setCaja] = useState<CajaMenudaDetailType | null>(null);
  const [gastos, setGastos] = useState<CajaMenudaGasto[]>([]);
  const [adjuntos, setAdjuntos] = useState<CajaMenudaAdjunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Gastos filter: 'pending' or a solicitud_reembolso_id
  const [gastosFilter, setGastosFilter] = useState<string>('pending');

  // Gasto form
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [editingGasto, setEditingGasto] = useState<CajaMenudaGasto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteGastoId, setDeleteGastoId] = useState<number | null>(null);

  // Batch gastos modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchRows, setBatchRows] = useState<Array<{
    fecha: string; proveedor: string; descripcion: string;
    monto: string; itbms: string; monto_total: string;
  }>>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Adjunto upload
  const [uploading, setUploading] = useState(false);
  const [deleteAdjuntoId, setDeleteAdjuntoId] = useState<number | null>(null);
  const [showReembolsoConfirm, setShowReembolsoConfirm] = useState(false);
  const [reembolsoSubmitting, setReembolsoSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Opening comprobante upload (from the warning banner)
  const [uploadingApertura, setUploadingApertura] = useState(false);
  const aperturaInputRef = useRef<HTMLInputElement>(null);

  // Historial comprobante upload (per-row, from the historial table)
  const [uploadingHistorialId, setUploadingHistorialId] = useState<number | null>(null);
  const historialInputRef = useRef<HTMLInputElement>(null);
  const [pendingHistorialId, setPendingHistorialId] = useState<number | null>(null);

  const gastoForm = useForm<GastoFormData>({
    resolver: zodResolver(gastoSchema),
    defaultValues: { fecha: '', proveedor: '', descripcion: '', monto: '', itbms: '0', monto_total: '' },
  });

  // Watch monto and itbms to auto-calculate total
  const watchMonto = gastoForm.watch('monto');
  const watchItbms = gastoForm.watch('itbms');

  useEffect(() => {
    const monto = Number(watchMonto) || 0;
    const itbms = Number(watchItbms) || 0;
    if (monto > 0) {
      gastoForm.setValue('monto_total', (monto + itbms).toFixed(2));
    }
  }, [watchMonto, watchItbms, gastoForm]);

  // Load data
  useEffect(() => {
    loadCaja();
  }, [cajaId]);

  useEffect(() => {
    loadGastos();
    loadAdjuntos();
  }, [cajaId, gastosFilter]);

  const loadCaja = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await api.get(`/cajas-menudas/${cajaId}`);
      if (response.data.success) {
        const cajaData = response.data.data;
        setCaja(cajaData);
      }
    } catch (err) {
      console.error('Error cargando caja menuda:', err);
      setError('Error al cargar la caja menuda');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (caja?.estado === 'cerrada') {
      setGastosFilter('cierre');
    }
  }, [caja?.estado]);

  const loadGastos = async () => {
    try {
      const filterParam = gastosFilter === 'cierre' ? 'pending' : gastosFilter;
      const filter = filterParam === 'pending' ? 'null' : filterParam;
      const response = await api.get(`/cajas-menudas/${cajaId}/gastos?solicitud_reembolso_id=${filter}`);
      if (response.data.success) {
        setGastos(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando gastos:', err);
    }
  };

  const loadAdjuntos = async () => {
    try {
      const filterParam = gastosFilter === 'cierre' ? 'pending' : gastosFilter;
      const filter = filterParam === 'pending' ? 'null' : filterParam;
      const response = await api.get(`/cajas-menudas/${cajaId}/adjuntos?solicitud_reembolso_id=${filter}`);
      if (response.data.success) {
        setAdjuntos(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando adjuntos:', err);
    }
  };

  // --- Gasto handlers ---

  const handleEditGasto = (gasto: CajaMenudaGasto) => {
    setEditingGasto(gasto);
    gastoForm.reset({
      fecha: gasto.fecha.split('T')[0],
      proveedor: gasto.proveedor,
      descripcion: gasto.descripcion,
      monto: String(gasto.monto),
      itbms: String(gasto.itbms),
      monto_total: String(gasto.monto_total),
    });
    setError('');
    setShowGastoModal(true);
  };

  const handleSubmitGasto = async (data: GastoFormData) => {
    try {
      setSubmitting(true);
      setError('');

      const payload = {
        fecha: data.fecha,
        proveedor: data.proveedor,
        descripcion: data.descripcion,
        monto: Number(data.monto),
        itbms: Number(data.itbms || 0),
        monto_total: Number(data.monto_total),
      };

      if (editingGasto) {
        await api.put(`/cajas-menudas/${cajaId}/gastos/${editingGasto.id}`, payload);
      } else {
        await api.post(`/cajas-menudas/${cajaId}/gastos`, payload);
      }

      setShowGastoModal(false);
      gastoForm.reset();
      loadGastos();
      loadCaja(); // Refresh saldo
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al guardar el gasto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGasto = async () => {
    if (!deleteGastoId) return;
    try {
      setSubmitting(true);
      await api.delete(`/cajas-menudas/${cajaId}/gastos/${deleteGastoId}`);
      setDeleteGastoId(null);
      loadGastos();
      loadCaja();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al eliminar el gasto');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Batch gasto handlers ---

  const emptyRow = () => ({ fecha: '', proveedor: '', descripcion: '', monto: '', itbms: '0', monto_total: '' });

  const handleOpenBatch = () => {
    setBatchRows([emptyRow()]);
    setError('');
    setShowBatchModal(true);
  };

  const handleBatchRowChange = (index: number, field: string, value: string) => {
    setBatchRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calculate total
      if (field === 'monto' || field === 'itbms') {
        const monto = Number(field === 'monto' ? value : updated[index].monto) || 0;
        const itbms = Number(field === 'itbms' ? value : updated[index].itbms) || 0;
        updated[index].monto_total = (monto + itbms).toFixed(2);
      }
      return updated;
    });
  };

  const handleAddBatchRow = () => {
    setBatchRows(prev => [...prev, emptyRow()]);
  };

  // --- Paste-from-Excel helpers ---

  // Column order in the batch grid (read-only "monto_total" excluded)
  const BATCH_COLUMNS: Array<'fecha' | 'proveedor' | 'descripcion' | 'monto' | 'itbms'> = [
    'fecha',
    'proveedor',
    'descripcion',
    'monto',
    'itbms',
  ];

  // Parse a pasted date string into YYYY-MM-DD, or '' if unparseable.
  // Accepted: DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, YYYY-MM-DD,
  // D-mes-YY, D-mes-YYYY, D/mes/YY, D mes YYYY (Spanish or English month abbr)
  const parsePastedDate = (raw: string): string => {
    const s = raw.trim();
    if (!s) return '';

    // YYYY-MM-DD (already correct format)
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // DD/MM/YYYY or DD-MM-YYYY (4-digit year required)
    const numMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (numMatch) {
      const [, d, m, y] = numMatch;
      const dn = parseInt(d, 10);
      const mn = parseInt(m, 10);
      if (dn >= 1 && dn <= 31 && mn >= 1 && mn <= 12) {
        return `${y}-${String(mn).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
      }
      return '';
    }

    // D-mes-YY(YY) or D/mes/YY(YY) or D mes YY(YY)
    const MONTHS: Record<string, number> = {
      ene: 1, jan: 1,
      feb: 2,
      mar: 3,
      abr: 4, apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      ago: 8, aug: 8,
      sep: 9, sept: 9,
      oct: 10,
      nov: 11,
      dic: 12, dec: 12,
    };
    const monMatch = s.match(/^(\d{1,2})[\s/-]([a-zA-ZáéíóúÁÉÍÓÚ]{3,4})[\s/-](\d{2}|\d{4})$/);
    if (monMatch) {
      const [, dStr, monStr, yStr] = monMatch;
      const monKey = monStr.toLowerCase().slice(0, 4);
      const mn = MONTHS[monKey] ?? MONTHS[monKey.slice(0, 3)];
      if (!mn) return '';
      const dn = parseInt(dStr, 10);
      if (dn < 1 || dn > 31) return '';
      let y = parseInt(yStr, 10);
      if (yStr.length === 2) y = y >= 70 ? 1900 + y : 2000 + y;
      return `${y}-${String(mn).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
    }

    return '';
  };

  // Parse a pasted number (strip currency symbols, thousands separators, normalize decimal)
  // Handles: "B/. 205.75", "$1,234.56", "1.234,56", "205,75", "205.75", "1234"
  const parsePastedNumber = (raw: string): string => {
    // Keep only digits, dots, commas, and a leading minus
    const negative = /-/.test(raw.trim().replace(/^[^-\d]*/, '').slice(0, 1));
    const s = raw.replace(/[^\d.,]/g, '');
    if (!s) return '';

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    let cleaned: string;

    if (lastDot >= 0 && lastComma >= 0) {
      // Both present — the rightmost one is the decimal separator
      if (lastComma > lastDot) {
        // 1.234,56 → 1234.56
        cleaned = s.replace(/\./g, '').replace(',', '.');
      } else {
        // 1,234.56 → 1234.56
        cleaned = s.replace(/,/g, '');
      }
    } else if (lastComma >= 0) {
      // Only commas — assume decimal separator
      cleaned = s.replace(',', '.');
    } else if (lastDot >= 0) {
      // Only dots — could be thousands or decimal. If more than one dot,
      // treat all but the last as thousands separators.
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount > 1) {
        const lastIdx = s.lastIndexOf('.');
        cleaned = s.slice(0, lastIdx).replace(/\./g, '') + '.' + s.slice(lastIdx + 1);
      } else {
        cleaned = s;
      }
    } else {
      cleaned = s;
    }

    const n = Number(cleaned);
    if (isNaN(n)) return '';
    return String(negative ? -n : n);
  };

  const handleBatchPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: 'fecha' | 'proveedor' | 'descripcion' | 'monto' | 'itbms',
  ) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    // Split into rows and columns. Excel uses \r\n between rows and \t between cols.
    const rawRows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    // Drop a single trailing empty row (Excel often appends one)
    if (rawRows.length > 1 && rawRows[rawRows.length - 1] === '') rawRows.pop();
    const cells = rawRows.map((r) => r.split('\t'));

    const isSingleCell = cells.length === 1 && cells[0].length === 1;
    // For numeric fields, always intercept so we can strip currency symbols
    // (e.g. "B/. 205.75"). Other fields fall through to default paste.
    const isNumericField = field === 'monto' || field === 'itbms';
    if (isSingleCell && !isNumericField) return;

    e.preventDefault();

    if (isSingleCell && isNumericField) {
      const cleaned = parsePastedNumber(cells[0][0]);
      handleBatchRowChange(rowIndex, field, cleaned);
      return;
    }

    const startCol = BATCH_COLUMNS.indexOf(field);

    setBatchRows((prev) => {
      const updated = [...prev];
      // Ensure enough rows exist
      while (updated.length < rowIndex + cells.length) {
        updated.push(emptyRow());
      }

      cells.forEach((rowCells, rOff) => {
        const targetRow = rowIndex + rOff;
        rowCells.forEach((cellValue, cOff) => {
          const targetCol = startCol + cOff;
          if (targetCol >= BATCH_COLUMNS.length) return;
          const targetField = BATCH_COLUMNS[targetCol];
          let value = cellValue;

          if (targetField === 'fecha') {
            value = parsePastedDate(cellValue);
          } else if (targetField === 'monto' || targetField === 'itbms') {
            value = parsePastedNumber(cellValue);
          }

          updated[targetRow] = { ...updated[targetRow], [targetField]: value };
        });

        // Recalculate total for this row if monto or itbms was touched
        const monto = Number(updated[targetRow].monto) || 0;
        const itbms = Number(updated[targetRow].itbms) || 0;
        if (monto > 0 || itbms > 0) {
          updated[targetRow].monto_total = (monto + itbms).toFixed(2);
        }
      });

      return updated;
    });
  };

  const handleRemoveBatchRow = (index: number) => {
    setBatchRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitBatch = async () => {
    // Filter out empty rows
    const validRows = batchRows.filter(r => r.fecha && r.proveedor && r.descripcion && Number(r.monto) > 0);
    if (validRows.length === 0) {
      setError('Agrega al menos un gasto con todos los campos');
      return;
    }
    // Validate max 2 decimals
    for (const row of validRows) {
      for (const field of ['monto', 'itbms', 'monto_total']) {
        const val = row[field as keyof typeof row];
        const parts = val.split('.');
        if (parts.length >= 2 && parts[1].length > 2) {
          setError(`Máximo 2 decimales en ${field}`);
          return;
        }
      }
    }
    try {
      setBatchSubmitting(true);
      setError('');
      for (const row of validRows) {
        await api.post(`/cajas-menudas/${cajaId}/gastos`, {
          fecha: row.fecha,
          proveedor: row.proveedor,
          descripcion: row.descripcion,
          monto: Number(row.monto),
          itbms: Number(row.itbms || 0),
          monto_total: Number(row.monto_total),
        });
      }
      setShowBatchModal(false);
      setBatchRows([]);
      loadGastos();
      loadCaja();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al guardar los gastos');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const batchTotal = batchRows.reduce((sum, r) => sum + (Number(r.monto_total) || 0), 0);
  const batchValidCount = batchRows.filter(r => r.fecha && r.proveedor && Number(r.monto) > 0).length;

  // --- Comprobante handlers ---

  const handleUploadApertura = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingApertura(true);
      setError('');
      const formData = new FormData();
      formData.append('comprobante_apertura', file);
      // PUT /:id accepts comprobante_apertura and doesn't require other fields
      await api.put(`/cajas-menudas/${cajaId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadCaja(false);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al subir el comprobante de apertura');
    } finally {
      setUploadingApertura(false);
      if (aperturaInputRef.current) aperturaInputRef.current.value = '';
    }
  };

  const handleDownloadApertura = async () => {
    try {
      const response = await api.get(`/cajas-menudas/${cajaId}/comprobante-apertura/download`);
      if (response.data.success) window.open(response.data.data.url, '_blank');
    } catch (err) {
      console.error('Error descargando comprobante de apertura:', err);
    }
  };

  const handleDownloadCierre = async () => {
    try {
      const response = await api.get(`/cajas-menudas/${cajaId}/comprobante-cierre/download`);
      if (response.data.success) window.open(response.data.data.url, '_blank');
    } catch (err) {
      console.error('Error descargando comprobante de cierre:', err);
    }
  };

  const handleUploadHistorialComprobante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const historialId = pendingHistorialId;
    if (!file || !historialId) return;
    try {
      setUploadingHistorialId(historialId);
      setError('');
      const formData = new FormData();
      formData.append('comprobante', file);
      await api.post(
        `/cajas-menudas/${cajaId}/historial-monto/${historialId}/comprobante`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      await loadCaja(false);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al subir el comprobante');
    } finally {
      setUploadingHistorialId(null);
      setPendingHistorialId(null);
      if (historialInputRef.current) historialInputRef.current.value = '';
    }
  };

  const triggerHistorialUpload = (historialId: number) => {
    setPendingHistorialId(historialId);
    historialInputRef.current?.click();
  };

  const handleDownloadHistorialComprobante = async (historialId: number) => {
    try {
      const response = await api.get(
        `/cajas-menudas/${cajaId}/historial-monto/${historialId}/comprobante/download`,
      );
      if (response.data.success) window.open(response.data.data.url, '_blank');
    } catch (err) {
      console.error('Error descargando comprobante de historial:', err);
    }
  };

  // --- Adjunto handlers ---

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      setError('');

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('archivo', file);
        await api.post(`/cajas-menudas/${cajaId}/adjuntos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      loadAdjuntos();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al subir el archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadSolicitudComprobante = async (solicitudId: number) => {
    try {
      const response = await api.get(`/solicitudes-pago/${solicitudId}/adjuntos/urls`);
      if (response.data.success && response.data.adjuntos?.length > 0) {
        const comprobante = response.data.adjuntos.find(
          (a: { tipo_adjunto?: string }) => a.tipo_adjunto === 'comprobante'
        ) || response.data.adjuntos[0];
        if (comprobante?.url) {
          window.open(comprobante.url, '_blank');
        }
      }
    } catch (err) {
      console.error('Error downloading solicitud comprobante:', err);
    }
  };

  const handleDownload = async (adjunto: CajaMenudaAdjunto) => {
    try {
      const response = await api.get(`/cajas-menudas/${cajaId}/adjuntos/${adjunto.id}/download`);
      if (response.data.success) {
        window.open(response.data.data.url, '_blank');
      }
    } catch (err) {
      console.error('Error descargando adjunto:', err);
    }
  };

  const handleDeleteAdjunto = async () => {
    if (!deleteAdjuntoId) return;
    try {
      setSubmitting(true);
      await api.delete(`/cajas-menudas/${cajaId}/adjuntos/${deleteAdjuntoId}`);
      setDeleteAdjuntoId(null);
      loadAdjuntos();
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al eliminar el adjunto');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Reembolso handler ---

  const handleReembolso = async () => {
    try {
      setReembolsoSubmitting(true);
      setError('');
      const response = await api.post(`/cajas-menudas/${cajaId}/reembolso`);
      if (response.data.success) {
        setShowReembolsoConfirm(false);
        setGastosFilter('pending');
        loadCaja();
        loadGastos();
        loadAdjuntos();
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Error al solicitar reembolso');
    } finally {
      setReembolsoSubmitting(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!caja) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Caja menuda no encontrada" />
      </div>
    );
  }

  const isPending = gastosFilter === 'pending';
  const selectedReembolso = caja.reembolsos?.find((r) => String(r.id) === gastosFilter);
  const gastosTotal = gastos.reduce((sum, g) => sum + Number(g.monto_total), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title={caja.nombre} subtitle={caja.proyecto_nombre}>
        <Badge
          className={caja.estado === 'abierta' ? 'bg-success/10 text-success border-success/30 border' : 'bg-slate-100 text-slate-600 border-slate-200 border'}
        >
          {caja.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
        </Badge>
      </PageHeader>

      {/* Apertura solicitud status */}
      {caja.solicitud_apertura_id ? (
        caja.solicitud_apertura_estado !== 'transferida' &&
        !(caja.solicitud_apertura_estado === 'rechazada' && Number(caja.monto_asignado) > 0) && (
          <Alert
            variant="error"
            title={
              caja.solicitud_apertura_estado === 'rechazada'
                ? 'Transferencia de apertura rechazada'
                : 'Transferencia de apertura pendiente'
            }
            description={
              caja.solicitud_apertura_estado === 'rechazada'
                ? `La solicitud de apertura (${caja.solicitud_apertura_numero}) fue rechazada. El monto asignado se ajustó a 0.`
                : `La solicitud de apertura (${caja.solicitud_apertura_numero}) aún no tiene transferencia registrada.`
            }
          />
        )
      ) : (
        /* Legacy: cajas created before solicitud flow */
        !caja.comprobante_apertura_r2_key && (
          <Alert
            variant="error"
            title="Sin comprobante de apertura"
            description="Esta caja menuda no tiene comprobante de apertura cargado."
            actions={
              <>
                <input
                  ref={aperturaInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleUploadApertura}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => aperturaInputRef.current?.click()}
                  disabled={uploadingApertura}
                >
                  {uploadingApertura ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Subir comprobante
                </Button>
              </>
            }
          />
        )
      )}

      {/* Opening comprobante download button (when present) */}
      {caja.comprobante_apertura_r2_key && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Comprobante de apertura:</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadApertura}
          >
            <Download className="mr-2 h-3 w-3" />
            Descargar
          </Button>
        </div>
      )}

      {/* Closing comprobante download button (when present) */}
      {caja.comprobante_cierre_r2_key && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Comprobante de cierre:</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadCierre}
          >
            <Download className="mr-2 h-3 w-3" />
            Descargar
          </Button>
        </div>
      )}

      {error && <Alert variant="error" title={error} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Monto Asignado</p>
            <p className="text-xl font-bold">{formatMonto(caja.monto_asignado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Saldo Disponible</p>
            <p className={`text-xl font-bold ${caja.estado === 'cerrada' ? '' : Number(caja.saldo) < 0 ? 'text-error' : 'text-success'}`}>
              {caja.estado === 'cerrada' ? '-' : formatMonto(caja.saldo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Gastado</p>
            <p className="text-xl font-bold">{formatMonto(caja.total_gastado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Responsable</p>
            <p className="text-lg font-medium">{caja.responsable_nombre}</p>
          </CardContent>
        </Card>
      </div>

      {/* Shared hidden file input for uploading historial comprobantes */}
      <input
        ref={historialInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleUploadHistorialComprobante}
      />

      {/* Gastos Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h3 className="text-lg font-semibold whitespace-nowrap">Gastos</h3>
            <Select value={gastosFilter} onValueChange={setGastosFilter}>
              <SelectTrigger className="min-w-0 flex-1 max-w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {caja.estado !== 'cerrada' && (
                  <SelectItem value="pending">Gastos actuales (pendientes de reembolso)</SelectItem>
                )}
                {caja.reembolsos?.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    Reembolso #{r.numero} — {r.estado}
                  </SelectItem>
                ))}
                {caja.estado === 'cerrada' && (
                  <SelectItem value="cierre">
                    Cierre — Gastos finales
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {isPending && caja.estado === 'abierta' && (
            <div className="flex flex-wrap gap-2 ml-auto flex-shrink-0 justify-end">
              <Button size="sm" onClick={handleOpenBatch}>
                <Plus className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Registrar</span> Gastos
              </Button>
              {gastos.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowReembolsoConfirm(true)}>
                  <Send className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Solicitar</span> Reembolso
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Past reembolo badge */}
        {!isPending && selectedReembolso && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            Solicitud #{selectedReembolso.numero} —
            <Badge variant="outline">{selectedReembolso.estado}</Badge>
            — {formatMonto(selectedReembolso.monto_total)}
          </div>
        )}

        {/* Cierre comprobante */}
        {gastosFilter === 'cierre' && caja.comprobante_cierre_r2_key && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCheck className="h-4 w-4" />
            <span>Comprobante de cierre:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadCierre}
            >
              <Download className="mr-2 h-3 w-3" />
              Descargar
            </Button>
          </div>
        )}

        {gastos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground">No hay gastos registrados</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
              {gastos.map((gasto) => (
                <Card key={gasto.id}>
                  <CardContent className="p-4 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{gasto.proveedor}</p>
                        <p className="text-sm text-muted-foreground">{gasto.descripcion}</p>
                      </div>
                      {isPending && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditGasto(gasto)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteGastoId(gasto.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-error" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{formatDate(gasto.fecha)}</span>
                      <span className="font-medium">{formatMonto(gasto.monto_total)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">ITBMS</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {isPending && <TableHead className="w-[80px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gastos.map((gasto) => (
                        <TableRow key={gasto.id}>
                          <TableCell>{formatDate(gasto.fecha)}</TableCell>
                          <TableCell>{gasto.proveedor}</TableCell>
                          <TableCell>{gasto.descripcion}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMonto(gasto.monto)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMonto(gasto.itbms)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatMonto(gasto.monto_total)}</TableCell>
                          {isPending && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEditGasto(gasto)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteGastoId(gasto.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-error" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Footer total */}
            <div className="flex justify-end">
              <div className="text-sm text-muted-foreground">
                {isPending ? 'Total pendiente:' : 'Total reembolsado:'}{' '}
                <span className="font-bold text-foreground">{formatMonto(gastosTotal)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Adjuntos Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Adjuntos</h3>
          {isPending && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Subir archivo
              </Button>
            </div>
          )}
        </div>

        {adjuntos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay archivos adjuntos</p>
        ) : (
          <div className="space-y-2">
            {adjuntos.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{adj.nombre_original}</p>
                    <p className="text-xs text-muted-foreground">
                      {adj.subido_por_nombre} — {(adj.tamano / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(adj)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {isPending && (
                    <Button variant="ghost" size="sm" onClick={() => setDeleteAdjuntoId(adj.id)}>
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de monto asignado */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Historial de monto asignado</h3>
        <Card>
          <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cambiado por</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Comprobante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Synthetic initial row */}
              <TableRow>
                <TableCell>{formatDate(caja.created_at)}</TableCell>
                <TableCell>{caja.created_by_nombre || '—'}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {(() => {
                    const sorted = [...(caja.historial_montos || [])].sort(
                      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                    const originalMonto = sorted.length > 0 ? sorted[0].monto_anterior : caja.monto_asignado;
                    return formatMonto(originalMonto);
                  })()}
                </TableCell>
                <TableCell>
                  {caja.solicitud_apertura_id ? (
                    caja.solicitud_apertura_estado === 'transferida' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadSolicitudComprobante(caja.solicitud_apertura_id!)}
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Descargar
                      </Button>
                    ) : caja.solicitud_apertura_estado === 'rechazada' ? (
                      <Badge className="bg-error/10 text-error border-error/30 border">
                        {caja.solicitud_apertura_numero} — Rechazada
                      </Badge>
                    ) : (
                      <Badge className="bg-warning/10 text-warning border-warning/30 border">
                        {caja.solicitud_apertura_numero} — Pendiente
                      </Badge>
                    )
                  ) : caja.comprobante_apertura_r2_key ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadApertura()}
                    >
                      <Download className="mr-2 h-3 w-3" />
                      Descargar
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>

              {/* Historial rows */}
              {caja.historial_montos?.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{formatDate(h.created_at)}</TableCell>
                  <TableCell>{h.cambiado_por_nombre}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMonto(h.monto_nuevo)}</TableCell>
                  <TableCell>
                    {h.solicitud_id ? (
                      h.solicitud_estado === 'transferida' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadSolicitudComprobante(h.solicitud_id!)}
                        >
                          <Download className="mr-2 h-3 w-3" />
                          Descargar
                        </Button>
                      ) : h.estado === 'rechazada' || h.solicitud_estado === 'rechazada' ? (
                        <Badge className="bg-error/10 text-error border-error/30 border">
                          {h.solicitud_numero} — Rechazada
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-warning/30 border">
                          {h.solicitud_numero} — Pendiente
                        </Badge>
                      )
                    ) : h.comprobante_r2_key ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadHistorialComprobante(h.id)}
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Descargar
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm text-error">
                          <AlertCircle className="h-3 w-3" />
                          Sin comprobante
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => triggerHistorialUpload(h.id)}
                          disabled={uploadingHistorialId === h.id}
                        >
                          {uploadingHistorialId === h.id ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-3 w-3" />
                          )}
                          Subir
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      </div>

      {/* Gasto Form Dialog */}
      <AppDialog
        open={showGastoModal}
        onOpenChange={setShowGastoModal}
        size="simple"
        title="Editar Gasto"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setShowGastoModal(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" form="edit-gasto-form" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar
            </Button>
          </>
        }
      >
        {error && showGastoModal && (
          <Alert variant="error" title={error} className="mb-4" />
        )}

        <Form {...gastoForm}>
          <form id="edit-gasto-form" onSubmit={gastoForm.handleSubmit(handleSubmitGasto)} className="space-y-4">
            <FormField
              control={gastoForm.control}
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={gastoForm.control}
              name="proveedor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del proveedor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={gastoForm.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl>
                    <Input placeholder="Descripción del gasto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={gastoForm.control}
                name="monto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={gastoForm.control}
                name="itbms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ITBMS</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={gastoForm.control}
                name="monto_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} readOnly className="bg-muted" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </AppDialog>

      {/* Batch Gastos Modal */}
      <AppDialog
        open={showBatchModal}
        onOpenChange={(open) => { if (!open) setShowBatchModal(false); }}
        size="complex"
        title="Registrar Gastos"
        footer={
          <>
            <span className="text-sm text-muted-foreground">
              Total: <strong className="text-foreground">{formatMonto(batchTotal)}</strong>
              {batchValidCount > 0 && ` (${batchValidCount} gasto${batchValidCount !== 1 ? 's' : ''})`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBatchModal(false)} disabled={batchSubmitting}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitBatch} disabled={batchSubmitting}>
                {batchSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Todo
              </Button>
            </div>
          </>
        }
      >
          {error && (
            <Alert variant="error" title={error} className="mb-2" />
          )}

          <p className="text-xs text-muted-foreground mb-2">
            Tip: puedes copiar varias celdas desde Excel y pegarlas aquí. Usa fechas en formato <strong>DD/MM/AAAA</strong> o <strong>1-mar-26</strong>.
          </p>

          <div className="overflow-x-auto overflow-y-auto max-h-[60vh] -mx-2">
            {/* Header */}
            <div className="grid grid-cols-[110px_1fr_1fr_80px_70px_80px_32px] bg-muted border-y px-1 sticky top-0 z-10">
              <span className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase">Fecha</span>
              <span className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase">Proveedor</span>
              <span className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase">Descripción</span>
              <span className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase text-right">Monto</span>
              <span className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase text-right">ITBMS</span>
              <span className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase text-right">Total</span>
              <span></span>
            </div>

            {/* Rows */}
            {batchRows.map((row, index) => (
              <div key={index} className="grid grid-cols-[110px_1fr_1fr_80px_70px_80px_32px] border-b last:border-b-0 px-1">
                <input
                  type="date"
                  className="px-2 py-2 text-sm border-r border-border/50 bg-transparent outline-none focus:bg-slate-50"
                  value={row.fecha}
                  onChange={(e) => handleBatchRowChange(index, 'fecha', e.target.value)}
                  onPaste={(e) => handleBatchPaste(e, index, 'fecha')}
                />
                <input
                  className="px-2 py-2 text-sm border-r border-border/50 bg-transparent outline-none focus:bg-slate-50"
                  placeholder="Proveedor"
                  value={row.proveedor}
                  onChange={(e) => handleBatchRowChange(index, 'proveedor', e.target.value)}
                  onPaste={(e) => handleBatchPaste(e, index, 'proveedor')}
                />
                <input
                  className="px-2 py-2 text-sm border-r border-border/50 bg-transparent outline-none focus:bg-slate-50"
                  placeholder="Descripción"
                  value={row.descripcion}
                  onChange={(e) => handleBatchRowChange(index, 'descripcion', e.target.value)}
                  onPaste={(e) => handleBatchPaste(e, index, 'descripcion')}
                />
                <input
                  type="number"
                  step="0.01"
                  className="px-2 py-2 text-sm text-right border-r border-border/50 bg-transparent outline-none focus:bg-slate-50"
                  placeholder="0.00"
                  value={row.monto}
                  onChange={(e) => handleBatchRowChange(index, 'monto', e.target.value)}
                  onPaste={(e) => handleBatchPaste(e, index, 'monto')}
                />
                <input
                  type="number"
                  step="0.01"
                  className="px-2 py-2 text-sm text-right border-r border-border/50 bg-transparent outline-none focus:bg-slate-50"
                  placeholder="0.00"
                  value={row.itbms}
                  onChange={(e) => handleBatchRowChange(index, 'itbms', e.target.value)}
                  onPaste={(e) => handleBatchPaste(e, index, 'itbms')}
                />
                <input
                  type="number"
                  className="px-2 py-2 text-sm text-right bg-muted/30 outline-none"
                  value={row.monto_total}
                  readOnly
                />
                <div className="flex items-center justify-center">
                  {batchRows.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemoveBatchRow(index)}>
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Add row */}
            <button
              type="button"
              className="w-full px-3 py-2 text-sm text-primary hover:bg-slate-50 text-left border-t"
              onClick={handleAddBatchRow}
            >
              ＋ Agregar fila
            </button>
          </div>
      </AppDialog>

      {/* Delete Gasto Confirmation */}
      <AlertDialog open={deleteGastoId !== null} onOpenChange={(open) => !open && setDeleteGastoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGasto}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Adjunto Confirmation */}
      <AlertDialog open={deleteAdjuntoId !== null} onOpenChange={(open) => !open && setDeleteAdjuntoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>El archivo será eliminado permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdjunto}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reembolso Confirmation */}
      <AlertDialog open={showReembolsoConfirm} onOpenChange={setShowReembolsoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Solicitar reembolso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará una solicitud de pago por {formatMonto(gastosTotal)} con {gastos.length} gasto{gastos.length !== 1 ? 's' : ''} pendiente{gastos.length !== 1 ? 's' : ''}.
              Los gastos quedarán vinculados a la solicitud y no podrán ser editados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reembolsoSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReembolso} disabled={reembolsoSubmitting}>
              {reembolsoSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Solicitar Reembolso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CajaMenudaDetail;
