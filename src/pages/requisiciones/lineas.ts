import type { LineaBorrador } from './tipos';

let siguienteClave = 0;
export const lineaVacia = (): LineaBorrador => ({
  clave: `n${(siguienteClave += 1)}`,
  cantidad: '',
  unidad: '',
  descripcion: '',
  renglon_desglose: '',
});

/** Una línea que no tiene nada escrito no cuenta: se descarta al guardar. */
export const lineaEnBlanco = (l: LineaBorrador): boolean =>
  !l.cantidad.trim() && !l.unidad.trim() && !l.descripcion.trim() && !l.renglon_desglose.trim();
