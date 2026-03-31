import React, { useEffect, useState } from 'react';
import axios from 'axios';
import logo from '../assets/logo.png';

const API_BASE = import.meta.env.PROD
  ? 'https://andrei-backend-production.up.railway.app/api'
  : 'http://localhost:5000/api';

interface VerificacionData {
  numero: string;
  fecha: string;
  beneficiario: string;
  concepto: string | null;
  monto_total: number;
  estado: string;
  proyecto_nombre: string | null;
  verificado: boolean;
  aprobaciones: Array<{ usuario_nombre: string; fecha: string }>;
}

const estadoLabels: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pendiente: {
    label: 'Pendiente',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  aprobada: {
    label: 'Aprobada',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  rechazada: {
    label: 'Rechazada',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
  pagada: {
    label: 'Pagada',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
  },
  facturada: {
    label: 'Facturada',
    color: 'text-violet-700',
    bg: 'bg-violet-50 border-violet-200',
  },
  borrador: {
    label: 'Borrador',
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
  },
  devolucion: {
    label: 'Devolución',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
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
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="h-6 w-6 text-red-500"
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
              <h2 className="text-lg font-semibold text-red-700 mb-2">
                No verificado
              </h2>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Verified badge */}
              <div className="bg-emerald-50 border-b border-emerald-200 p-4 text-center">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="h-5 w-5 text-emerald-600"
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
                <p className="text-sm font-semibold text-emerald-700">
                  Documento verificado
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Este documento es auténtico y fue emitido por Pinellas, S.A.
                </p>
              </div>

              {/* Details */}
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500">Solicitud de Pago</p>
                    <p className="text-base font-bold text-slate-800">
                      {data.numero}
                    </p>
                  </div>
                  {(() => {
                    const est = estadoLabels[data.estado] || {
                      label: data.estado,
                      color: 'text-gray-700',
                      bg: 'bg-gray-50 border-gray-200',
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
                  <p className="text-xs text-slate-500">Beneficiario</p>
                  <p className="font-medium text-slate-700">
                    {data.beneficiario}
                  </p>
                </div>

                {data.proyecto_nombre && (
                  <div className="text-sm">
                    <p className="text-xs text-slate-500">Proyecto</p>
                    <p className="font-medium text-slate-700">
                      {data.proyecto_nombre}
                    </p>
                  </div>
                )}

                {data.concepto && (
                  <div className="text-sm">
                    <p className="text-xs text-slate-500">Concepto</p>
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
                          className="flex items-center gap-2 text-emerald-700"
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
