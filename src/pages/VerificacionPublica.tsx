import React, { useEffect, useState } from 'react';
import axios from 'axios';
import logo from '../assets/logo.png';
import { isLocalDev } from '../services/api';

const API_BASE = isLocalDev()
  ? 'http://localhost:5000/api'
  : 'https://andrei-backend-production.up.railway.app/api';

interface VerificacionData {
  /** Un código puede ser de una solicitud de pago o de una orden de compra. */
  tipo?: 'solicitud_pago' | 'orden_compra';
  numero: string;
  fecha: string;
  beneficiario: string;
  concepto: string | null;
  monto_total: number;
  estado: string;
  proyecto_nombre: string | null;
  /** Solo en una orden de compra. */
  proveedor_ruc?: string | null;
  termino_dias?: number;
  verificado: boolean;
  aprobaciones: Array<{ usuario_nombre: string; fecha: string }>;
}

const estadoLabels: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pendiente: {
    label: 'Pendiente',
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/30',
  },
  aprobada: {
    label: 'Aprobada',
    color: 'text-success',
    bg: 'bg-success/10 border-success/30',
  },
  rechazada: {
    label: 'Rechazada',
    color: 'text-error',
    bg: 'bg-error/10 border-error/30',
  },
  pagada: {
    label: 'Pagada',
    color: 'text-info',
    bg: 'bg-info/10 border-info/30',
  },
  facturada: {
    label: 'Facturada',
    color: 'text-info',
    bg: 'bg-info/10 border-info/30',
  },
  borrador: {
    label: 'Borrador',
    color: 'text-slate-600',
    bg: 'bg-slate-50 border-slate-200',
  },
  devolucion: {
    label: 'Devolución',
    color: 'text-error',
    bg: 'bg-error/10 border-error/30',
  },
};

const estadoOrdenLabels: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pendiente: {
    label: 'Pendiente',
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/30',
  },
  rechazada: {
    label: 'Rechazada',
    color: 'text-error',
    bg: 'bg-error/10 border-error/30',
  },
  por_enviar: {
    label: 'Por enviar',
    color: 'text-slate-600',
    bg: 'bg-slate-50 border-slate-200',
  },
  enviada: {
    label: 'Enviada',
    color: 'text-teal',
    bg: 'bg-teal/10 border-teal/30',
  },
  recibida: {
    label: 'Recibida',
    color: 'text-info',
    bg: 'bg-info/10 border-info/30',
  },
  cerrada: {
    label: 'Cerrada',
    color: 'text-success',
    bg: 'bg-success/10 border-success/30',
  },
  dada_de_baja: {
    label: 'Dada de baja',
    color: 'text-slate-600',
    bg: 'bg-slate-50 border-slate-200',
  },
};

function formatMoney(amount: number): string {
  return `B/. ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const VerificacionPublica: React.FC = () => {
  const [data, setData] = useState<VerificacionData | null>(null);
  // Los dos papeles de Pinellas con QR se dibujan aqui; lo que cambia son los
  // nombres de los campos y el mapa de estados.
  const esOrden = data?.tipo === 'orden_compra';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/verificar\/([A-Za-z0-9]+)$/);
    if (!match) {
      setError('Código de verificación no válido');
      setLoading(false);
      return;
    }

    const codigo = match[1];

    axios
      .get(`${API_BASE}/verificar/${codigo}`)
      .then((res) => {
        if (res.data.success) {
          setData(res.data.data);
        } else {
          setError(res.data.message || 'Código no válido');
        }
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError(
            'Código de verificación no válido. Este documento no existe en nuestro sistema.',
          );
        } else {
          setError('Error al verificar. Intente nuevamente.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <img src={logo} alt="Pinellas S.A." className="h-16 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-700">
            Verificación de Documento
          </h1>
          <p className="text-sm text-slate-500">
            Sistema Andrei — Pinellas, S.A.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {loading && (
            <div className="p-12 text-center">
              <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Verificando documento...</p>
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="h-6 w-6 text-error"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-error mb-2">
                No verificado
              </h2>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Verified badge */}
              <div className="bg-success/[0.06] border-b border-success/20 p-4 text-center">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="h-5 w-5 text-success"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-success">
                  Documento verificado
                </p>
                <p className="text-xs text-success mt-0.5">
                  Este documento es auténtico y fue emitido por Pinellas, S.A.
                </p>
              </div>

              {/* Details */}
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500">
                      {esOrden ? 'Orden de Compra' : 'Solicitud de Pago'}
                    </p>
                    <p className="text-base font-bold text-slate-800">
                      {data.numero}
                    </p>
                  </div>
                  {(() => {
                    const mapa = esOrden ? estadoOrdenLabels : estadoLabels;
                    const est = mapa[data.estado] || {
                      label: data.estado,
                      color: 'text-slate-600',
                      bg: 'bg-slate-50 border-slate-200',
                    };
                    return (
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${est.bg} ${est.color}`}
                      >
                        {est.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Fecha</p>
                    <p className="font-medium text-slate-700">
                      {formatDate(data.fecha)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Monto Total</p>
                    <p className="font-bold text-slate-800">
                      {formatMoney(data.monto_total)}
                    </p>
                  </div>
                </div>

                <div className="text-sm">
                  <p className="text-xs text-slate-500">
                    {esOrden ? 'Proveedor' : 'Beneficiario'}
                  </p>
                  <p className="font-medium text-slate-700">
                    {data.beneficiario}
                  </p>
                  {esOrden && data.proveedor_ruc && (
                    <p className="text-xs text-slate-500 tabular-nums">
                      RUC {data.proveedor_ruc}
                    </p>
                  )}
                </div>

                {data.proyecto_nombre && (
                  <div className="text-sm">
                    <p className="text-xs text-slate-500">Proyecto</p>
                    <p className="font-medium text-slate-700">
                      {data.proyecto_nombre}
                    </p>
                  </div>
                )}

                {esOrden && data.termino_dias !== undefined && (
                  <div className="text-sm">
                    <p className="text-xs text-slate-500">Término de pago</p>
                    <p className="font-medium text-slate-700">
                      {data.termino_dias === 0
                        ? 'Contado'
                        : `${data.termino_dias} días desde cada entrega`}
                    </p>
                  </div>
                )}

                {data.concepto && (
                  <div className="text-sm">
                    <p className="text-xs text-slate-500">
                      {esOrden ? 'Condiciones de compra' : 'Concepto'}
                    </p>
                    <p className="font-medium text-slate-700">
                      {data.concepto}
                    </p>
                  </div>
                )}

                {/* Aprobaciones */}
                {data.aprobaciones.length > 0 && (
                  <div className="text-sm border-t border-slate-100 pt-3 mt-3">
                    <p className="text-xs text-slate-500 mb-2">Aprobaciones</p>
                    <div className="space-y-1.5">
                      {data.aprobaciones.map((ap, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-success"
                        >
                          <svg
                            className="h-3.5 w-3.5 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span className="font-medium text-sm">
                            {ap.usuario_nombre}
                          </span>
                          <span className="text-xs text-slate-400 ml-auto">
                            {formatDate(ap.fecha)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Pinellas, S.A. &mdash; Sistema de Gestión de Proyectos
        </p>
      </div>
    </div>
  );
};

export default VerificacionPublica;
