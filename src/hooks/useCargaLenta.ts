import { useEffect, useState } from 'react';

/**
 * Dice si una carga ya tardó lo bastante como para enseñar el esqueleto.
 *
 * Lo que llega en menos de 0.3 s no debe pasar por el gris: el esqueleto
 * aparecía y se iba en unas centésimas de segundo y se veía como un parpadeo
 * (Ivan, 01/10). Mientras tanto el esqueleto se dibuja igual pero invisible,
 * para que guarde su sitio y nada salte cuando llegan los datos:
 *
 *   const lenta = useCargaLenta(cargando);
 *   <TableSkeleton className={cn(!lenta && 'invisible')} />
 */
export function useCargaLenta(cargando: boolean, ms = 300): boolean {
  const [paso, setPaso] = useState(false);

  useEffect(() => {
    if (!cargando) return;
    const t = setTimeout(() => setPaso(true), ms);
    return () => {
      clearTimeout(t);
      setPaso(false);
    };
  }, [cargando, ms]);

  return cargando && paso;
}
