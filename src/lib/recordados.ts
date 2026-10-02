// src/lib/recordados.ts — lo último que se trajo de cada lista y de cada orden.
//
// Volver a una pantalla ya vista la enseña al instante con lo que tenía, y la
// pantalla la refresca por detrás. Sin esto, cada vuelta pasaba unas centésimas
// de segundo por el esqueleto gris y se veía como un parpadeo (Ivan, 01/10).
//
// Vive solo en la memoria de la pestaña: se pierde al recargar la página y se
// BORRA al entrar y al salir del sistema, para que quien use la computadora
// después nunca vea, ni un instante, lo de otra persona.
const memoria = new Map<string, unknown>();

export function recordado<T>(clave: string): T | undefined {
  return memoria.get(clave) as T | undefined;
}

export function recordar<T>(clave: string, datos: T): void {
  memoria.set(clave, datos);
}

export function olvidarTodo(): void {
  memoria.clear();
}
