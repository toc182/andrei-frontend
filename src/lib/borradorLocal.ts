/**
 * Lo que alguien está escribiendo, guardado en su navegador mientras escribe,
 * para ofrecérselo al volver si no llegó a guardarse.
 *
 * Nace con el reporte diario (2026-09-14): el ingeniero Cesar llenó un reporte en
 * Playa Blanca, el envío falló por una foto de 11 MB y salió del formulario. El
 * 2026-11-12 le pasó lo mismo con una requisición de muchas líneas: se le cerró
 * la ventana y tuvo que escribirla otra vez. Las dos usan esto; cada formulario
 * pone su clave y dice qué vale la pena recordar.
 *
 * Solo texto y lo elegido, nunca archivos: un archivo no cabe en localStorage.
 *
 * localStorage puede fallar (navegación privada, almacenamiento lleno o
 * bloqueado): cada acceso va en try/catch, y si falla simplemente no se recuerda
 * nada y el formulario sigue funcionando como antes.
 */

/** Lo guardado, con cuándo se tocó por última vez (ISO). */
export type Guardado<T> = T & { guardadoEn: string };

export function leerBorrador<T>(clave: string, tieneContenido: (x: T) => boolean): Guardado<T> | null {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return null;
    const x = JSON.parse(crudo) as Guardado<T>;
    return tieneContenido(x) ? x : null;
  } catch {
    return null;
  }
}

/** Sin nada que valga la pena, borra lo que hubiera: un formulario vacío no se ofrece. */
export function guardarBorrador<T>(clave: string, x: T, tieneContenido: (x: T) => boolean): void {
  try {
    if (!tieneContenido(x)) {
      localStorage.removeItem(clave);
      return;
    }
    const guardado: Guardado<T> = { ...x, guardadoEn: new Date().toISOString() };
    localStorage.setItem(clave, JSON.stringify(guardado));
  } catch {
    // Sin almacenamiento no se recuerda nada; el formulario sigue funcionando.
  }
}

export function borrarBorrador(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Igual que arriba.
  }
}
