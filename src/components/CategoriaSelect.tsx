// Categoría de gasto picker — issue #71.
//
// Shared by the solicitud de pago form and the solicitud detail dialog.
// The category is never required, so "Sin categoría" is a real option rather
// than an empty placeholder waiting to be filled.
//
// Creating a category is admin-only on purpose: if everyone raising a
// solicitud could add one, the catalog fills up with "Materiales" /
// "materiales" / "Mat." and every company-wide total splits across the
// near-duplicates.

import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

export interface CategoriaGasto {
  id: number;
  nombre: string;
  codigo: string;
}

const SIN_CATEGORIA = 'none';
const CREAR_NUEVA = '__crear__';

interface CategoriaSelectProps {
  value: number | null | undefined;
  onChange: (categoriaId: number | null) => void;
  disabled?: boolean;
  className?: string;
}

export function CategoriaSelect({
  value,
  onChange,
  disabled,
  className = 'h-9',
}: CategoriaSelectProps) {
  const { user } = useAuth();
  const puedeCrear = user?.rol === 'admin' || user?.rol === 'co-admin';

  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      try {
        const response = await api.get('/costs/categories');
        if (!cancelado) setCategorias(response.data.categories || []);
      } catch {
        if (!cancelado) setError('No se pudieron cargar las categorías');
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  const handleSelectChange = (nuevo: string) => {
    if (nuevo === CREAR_NUEVA) {
      setNombreNuevo('');
      setError(null);
      setCreando(true);
      return;
    }
    onChange(nuevo === SIN_CATEGORIA ? null : Number(nuevo));
  };

  const cancelarCreacion = () => {
    setCreando(false);
    setNombreNuevo('');
    setError(null);
  };

  const crearCategoria = async () => {
    const nombre = nombreNuevo.trim();
    if (nombre.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const response = await api.post('/costs/categories', { nombre });
      const creada: CategoriaGasto = response.data.category;

      // The endpoint reactivates a retired category with the same name
      // instead of creating a duplicate, so it may already be in the list.
      setCategorias((previas) =>
        previas.some((c) => c.id === creada.id)
          ? previas
          : [...previas, creada].sort((a, b) =>
              a.nombre.localeCompare(b.nombre),
            ),
      );
      onChange(creada.id);
      cancelarCreacion();
    } catch (err) {
      const mensaje =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'No se pudo crear la categoría';
      setError(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  if (creando) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                crearCategoria();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelarCreacion();
              }
            }}
            placeholder="Nombre de la categoría"
            className="h-9"
            disabled={guardando}
          />
          <Button
            type="button"
            size="sm"
            className="h-9 px-3"
            onClick={crearCategoria}
            disabled={guardando}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-3"
            onClick={cancelarCreacion}
            disabled={guardando}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Select
        value={value ? String(value) : SIN_CATEGORIA}
        onValueChange={handleSelectChange}
        disabled={disabled || cargando}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder="Sin categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_CATEGORIA}>
            <span className="text-muted-foreground">Sin categoría</span>
          </SelectItem>
          {categorias.map((categoria) => (
            <SelectItem key={categoria.id} value={String(categoria.id)}>
              {categoria.nombre}
            </SelectItem>
          ))}
          {puedeCrear && (
            <>
              <div className="my-1 h-px bg-border" />
              <SelectItem value={CREAR_NUEVA}>
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Crear nueva categoría
                </span>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>
      {error && !cargando && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
