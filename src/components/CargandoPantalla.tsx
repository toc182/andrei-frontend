import { Skeleton } from '@/components/ui/skeleton';
import { useCargaLenta } from '@/hooks/useCargaLenta';
import { cn } from '@/lib/utils';

/**
 * Lo que se ve mientras llega el código de una pantalla (src/pages/pantallas.ts).
 * Lo que llega en menos de 0,3 s no se ve (useCargaLenta), igual que los
 * esqueletos de las listas. Es el mismo esqueleto que la ficha de un proyecto
 * mientras carga.
 */
export function CargandoPantalla() {
  const lenta = useCargaLenta(true);
  return (
    <div className={cn('space-y-4', !lenta && 'invisible')}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
