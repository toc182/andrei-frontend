// Red de seguridad de la hoja de presupuesto armada desde el desglose.
// cd andrei-frontend && npx tsx scripts/presupuesto-hoja.spec.ts
import {
  avanceCostos, computeTotales, costoPropio, costosCambiados, esContenedor,
  precioPropio, tieneHijos, toHojaRows, TOTAL_KEY,
} from '../src/lib/presupuestoHoja';
import type { PresupuestoRenglon } from '../src/lib/presupuestoApi';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++; else { failed++; console.log(`FAIL  ${label}`); }
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const r = (over: Partial<PresupuestoRenglon> & { id: number }): PresupuestoRenglon => ({
  rowUid: `u${over.id}`, parentId: null, tipo: 'item', codigo: '', descripcion: '',
  unidad: null, cantidad: null, precioUnitario: null, costoUnitario: null, orden: over.id,
  ...over,
});

/** El desglose del mock aprobado: dos secciones con dos renglones cada una. */
const desglose = (): PresupuestoRenglon[] => [
  r({ id: 1, tipo: 'grupo', codigo: '1', descripcion: 'Movimiento de tierra', orden: 0 }),
  r({ id: 2, parentId: 1, codigo: '1.01', descripcion: 'Excavación', unidad: 'm³', cantidad: 320, precioUnitario: 12.5, costoUnitario: 9.2, orden: 1 }),
  r({ id: 3, parentId: 1, codigo: '1.02', descripcion: 'Relleno', unidad: 'm³', cantidad: 150, precioUnitario: 9.8, costoUnitario: 7.4, orden: 2 }),
  r({ id: 4, tipo: 'grupo', codigo: '2', descripcion: 'Estructura', orden: 3 }),
  r({ id: 5, parentId: 4, codigo: '2.01', descripcion: 'Concreto', unidad: 'm³', cantidad: 80, precioUnitario: 310, costoUnitario: 247.45, orden: 4 }),
  r({ id: 6, parentId: 4, codigo: '2.02', descripcion: 'Acero', unidad: 'kg', cantidad: 3600, precioUnitario: 2.1, costoUnitario: null, orden: 5 }),
];

// ---- el arbol se aplana en orden, con profundidad ----
{
  const rows = toHojaRows(desglose());
  ok(rows.map((x) => x.id).join(',') === '1,2,3,4,5,6', 'arbol: orden de documento');
  ok(rows.map((x) => x.depth).join(',') === '0,1,1,0,1,1', 'arbol: profundidad por padre');
  ok(tieneHijos(rows, 0) && !tieneHijos(rows, 1), 'arbol: tieneHijos por profundidad');
  ok(esContenedor(rows, 0) && !esContenedor(rows, 1), 'arbol: la seccion con hijos es contenedor');

  // Desordenar la entrada no cambia nada: el orden sale de `orden`, no del array.
  const revuelto = [...desglose()].reverse();
  ok(toHojaRows(revuelto).map((x) => x.id).join(',') === '1,2,3,4,5,6',
    'arbol: se ordena por `orden`, no por como llegan');
}
// ---- monto propio ----
{
  const rows = toHojaRows(desglose());
  ok(costoPropio(rows, 1) === 2944, 'fila: costo = cantidad × costo unitario');
  ok(precioPropio(rows, 1) === 4000, 'fila: precio = cantidad × precio unitario');
  ok(costoPropio(rows, 0) === 0 && precioPropio(rows, 0) === 0,
    'fila: una seccion con hijos no aporta monto propio');
  ok(costoPropio(rows, 5) === 0, 'fila: sin costo escrito el costo es 0, no el precio');
  ok(precioPropio(rows, 5) === 7560, 'fila: el precio existe aunque falte el costo');

  // Un grupo SIN hijos es "seccion de una linea" y si lleva sus montos.
  const sueltos = toHojaRows([
    r({ id: 9, tipo: 'grupo', descripcion: 'Sección de una línea', cantidad: 2, precioUnitario: 50, costoUnitario: 30, orden: 0 }),
  ]);
  ok(!esContenedor(sueltos, 0), 'fila: un grupo sin hijos no es contenedor');
  ok(costoPropio(sueltos, 0) === 60 && precioPropio(sueltos, 0) === 100,
    'fila: la seccion de una linea lleva sus propios montos');
}
// ---- totales: las ramas suben y no se cuentan dos veces ----
{
  const rows = toHojaRows(desglose());
  const t = computeTotales(rows);
  ok(t.get(1)!.costo === 4054 && t.get(1)!.precio === 5470, 'totales: la seccion acumula su rama');
  ok(near(t.get(4)!.costo, 19796) && t.get(4)!.precio === 32360, 'totales: segunda seccion');
  const total = t.get(TOTAL_KEY)!;
  ok(near(total.costo, 23850), 'totales: costo de la hoja');
  ok(total.precio === 37830, 'totales: precio de la hoja');
  ok(near(total.costo, t.get(1)!.costo + t.get(4)!.costo),
    'totales: el total es la suma de las secciones, sin contarlas dos veces');
}
// ---- cuanto falta por costear ----
{
  const rows = toHojaRows(desglose());
  const a = avanceCostos(rows);
  ok(a.conCosto === 3 && a.sinCosto === 1, 'avance: cuenta renglones, no secciones');
  const todos = toHojaRows(desglose().map((x) => (x.id === 6 ? { ...x, costoUnitario: 1.62 } : x)));
  ok(avanceCostos(todos).sinCosto === 0, 'avance: sin faltantes cuando todos tienen costo');
}
// ---- al guardar solo viajan los costos que cambiaron ----
{
  const original = desglose();
  const rows = toHojaRows(original);
  ok(costosCambiados(original, rows).length === 0, 'guardar: sin cambios no viaja nada');

  const tocado = rows.map((x) => (x.id === 6 ? { ...x, costoUnitario: 1.62 } : x));
  const d = costosCambiados(original, tocado);
  ok(d.length === 1 && d[0].id === 6 && d[0].costoUnitario === 1.62, 'guardar: solo el renglon tocado');

  const borrado = rows.map((x) => (x.id === 2 ? { ...x, costoUnitario: null } : x));
  const d2 = costosCambiados(original, borrado);
  ok(d2.length === 1 && d2[0].costoUnitario === null, 'guardar: borrar un costo tambien viaja');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
