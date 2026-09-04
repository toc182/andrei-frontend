// Red de seguridad del modelo de la Hoja de Presupuesto.
// cd andrei-frontend && npx tsx scripts/presupuesto.spec.ts
import {
  appendRow, calculoTotal, calculoTotalPorClase, canMoveSubtree, computeTotals,
  deleteSubtree, emptyCalculo, hasChildren, indentLegal, indentRows,
  insertRowAfter, lineaTotal, moveSubtree, outdentRows, precioUnitarioMostrado,
  resumenHoja, rowCosto, toWireRenglones,
  GENERALES_TOTAL_KEY, GRAND_TOTAL_KEY, ITEMS_TOTAL_KEY,
  type PresupuestoRow, type RenglonCalculo,
} from '../src/lib/presupuestoModel';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++; else { failed++; console.log(`FAIL  ${label}`); }
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const row = (over: Partial<PresupuestoRow>): PresupuestoRow => ({
  tempId: 0, depth: 0, seccion: 'items', tipo: 'item', codigo: '', descripcion: '',
  unidad: null, cantidad: null, precioUnitario: null, usaCalculo: false, calculo: null,
  ...over,
});

/** La cuadrilla que Ivan aprobo el 2026-08-24: una fila por trabajador y TODAS
 *  las columnas multiplican. Cantidad x Dias x Salario dia x Prestaciones. */
const cuadrilla = (): RenglonCalculo => {
  const cant = { uid: 'c1', nombre: 'Cantidad' };
  const dias = { uid: 'c2', nombre: 'Días' };
  const sal = { uid: 'c3', nombre: 'Salario día' };
  const pres = { uid: 'c4', nombre: 'Prestaciones' };
  return {
    columnas: [cant, dias, sal, pres],
    lineas: [
      { uid: 'l1', concepto: 'Capataz', clase: 'mano_obra', valores: { c1: 1, c2: 8, c3: 30, c4: 1.42 } },
      { uid: 'l2', concepto: 'Albañil', clase: 'mano_obra', valores: { c1: 3, c2: 8, c3: 22, c4: 1.42 } },
      { uid: 'l3', concepto: 'Ayudante', clase: 'mano_obra', valores: { c1: 5, c2: 8, c3: 14, c4: 1.42 } },
    ],
  };
};

// ---- calculo: el producto de todas las columnas ----
{
  const c = cuadrilla();
  ok(near(lineaTotal(c, c.lineas[0]), 340.8), 'linea: 1 × 8 × 30 × 1.42 = 340.80');
  ok(near(lineaTotal(c, c.lineas[1]), 749.76), 'linea: 3 × 8 × 22 × 1.42 = 749.76');
  ok(near(lineaTotal(c, c.lineas[2]), 795.2), 'linea: 5 × 8 × 14 × 1.42 = 795.20');
  ok(near(calculoTotal(c), 1885.76), 'calculo: el renglon suma sus lineas');
  ok(near(calculoTotalPorClase(c, 'mano_obra'), 1885.76), 'calculo: subtotal por clase');
  ok(calculoTotalPorClase(c, 'material') === 0, 'calculo: clase sin lineas vale 0');
}
// ---- calculo: la casilla vacia NO multiplica ----
{
  const c: RenglonCalculo = {
    columnas: [{ uid: 'a', nombre: 'Cantidad' }, { uid: 'b', nombre: 'Días' }],
    lineas: [
      // Equipo de seguridad: va por persona, NO por dia. Dejar Dias vacio tiene
      // que dar 8 × 85, no 0 y tampoco arrastrar el 8 de la fila de al lado.
      { uid: 'l1', concepto: 'Equipo de seguridad', clase: null, valores: { a: 8, b: null } },
      { uid: 'l2', concepto: 'Fila en blanco', clase: null, valores: {} },
    ],
  };
  ok(lineaTotal(c, c.lineas[0]) === 8, 'linea: una casilla vacia no multiplica');
  ok(lineaTotal(c, c.lineas[1]) === 0, 'linea: sin ninguna casilla llena vale 0, no 1');
  ok(calculoTotal(null) === 0, 'calculo: sin tabla vale 0');
  ok(emptyCalculo().columnas.length === 1 && emptyCalculo().lineas.length === 1,
    'calculo: la tabla nace con una columna y una linea');
}
// ---- costo del renglon ----
{
  const rows: PresupuestoRow[] = [
    row({ tempId: 1, cantidad: 80, precioUnitario: 12.5 }),                       // 1000
    row({ tempId: 2, usaCalculo: true, calculo: cuadrilla(), cantidad: 8 }),      // 1885.76
    row({ tempId: 3, precioUnitario: 2800 }),                                     // monto suelto
    row({ tempId: 4 }),                                                           // vacio
  ];
  ok(rowCosto(rows, 0) === 1000, 'renglon: cantidad × precio');
  ok(near(rowCosto(rows, 1), 1885.76), 'renglon: con calculo vale lo que suma su tabla');
  ok(rowCosto(rows, 2) === 2800, 'renglon: precio sin cantidad vale el precio');
  ok(rowCosto(rows, 3) === 0, 'renglon: sin nada vale 0');
  ok(near(precioUnitarioMostrado(rows, 1) ?? 0, 235.72), 'renglon: unitario = costo ÷ cantidad');
  ok(precioUnitarioMostrado(rows, 0) === 12.5, 'renglon: sin calculo el unitario es el escrito');
  ok(precioUnitarioMostrado(rows, 2) === 2800, 'renglon: sin cantidad devuelve el precio escrito');
}
// ---- totales de la hoja: secciones y ramas ----
{
  const rows: PresupuestoRow[] = [
    row({ tempId: 1, tipo: 'grupo', descripcion: 'Fundaciones' }),
    row({ tempId: 2, depth: 1, cantidad: 320, precioUnitario: 12.5 }),  // 4000
    row({ tempId: 3, depth: 1, cantidad: 80, precioUnitario: 100 }),    // 8000
    row({ tempId: 4, seccion: 'generales', precioUnitario: 2800 }),     // 2800
    row({ tempId: 5, seccion: 'generales', usaCalculo: true, calculo: cuadrilla() }),
  ];
  const t = computeTotals(rows);
  ok(t.get(1) === 12000, 'totales: la seccion acumula su rama');
  ok(t.get(ITEMS_TOTAL_KEY) === 12000, 'totales: subtotal de items');
  ok(near(t.get(GENERALES_TOTAL_KEY) ?? 0, 4685.76), 'totales: subtotal de Costos Generales');
  ok(near(t.get(GRAND_TOTAL_KEY) ?? 0, 16685.76), 'totales: gran total = items + generales');
  ok(hasChildren(rows, 0) && !hasChildren(rows, 1), 'totales: hasChildren por profundidad');
  ok(rowCosto(rows, 0) === 0, 'totales: una seccion con hijos no vale nada por si misma');

  // El factor multiplica TODOS los renglones y el ITBMS va al final, encima.
  const r = resumenHoja(rows, 1.15, 7);
  ok(near(r.costo, 16685.76), 'resumen: el costo va sin factor');
  ok(near(r.subtotal, 16685.76 * 1.15), 'resumen: el subtotal lleva el factor');
  ok(near(r.itbms, 16685.76 * 1.15 * 0.07), 'resumen: el ITBMS va sobre el subtotal');
  ok(near(r.total, 16685.76 * 1.15 * 1.07), 'resumen: total = subtotal + ITBMS');
  ok(resumenHoja(rows, 1, null).itbms === 0, 'resumen: sin tasa no hay ITBMS');
}
// ---- cable ----
{
  const rows: PresupuestoRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),
    row({ tempId: 2, depth: 1 }),
    row({ tempId: 3, seccion: 'generales', usaCalculo: false, calculo: cuadrilla() }),
  ];
  const wire = toWireRenglones(rows);
  ok(wire[0].parentTempId === null && wire[1].parentTempId === 1, 'cable: el padre sale de la profundidad');
  ok(wire[1].seccion === 'items' && wire[2].seccion === 'generales', 'cable: la seccion viaja tal cual');
  ok(wire[2].calculo === null, 'cable: sin usaCalculo la tabla no se manda');
  ok(wire.every((w, i) => w.orden === i), 'cable: el orden sale de la posicion');
}
// ---- estructura: las dos secciones no se mezclan ----
{
  const rows: PresupuestoRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),
    row({ tempId: 2 }),
    row({ tempId: 3, seccion: 'generales' }),
  ];
  ok(indentLegal(rows, 1), 'estructura: sangrar dentro de la misma seccion es legal');
  ok(!indentLegal(rows, 2), 'estructura: Costos Generales no se mete dentro de un item');
  ok(indentRows(rows, 2) === rows, 'estructura: sangrar cruzando seccion no cambia nada');
  ok(!canMoveSubtree(rows, 2, -1), 'estructura: no se sube por encima de la otra seccion');
  ok(indentRows(rows, 1) !== rows && indentRows(rows, 1)[1].depth === 1, 'estructura: sangrar suma un nivel');
  ok(outdentRows(rows, 0) === rows, 'estructura: en el nivel 0 no se puede sacar');
  ok(moveSubtree(rows, 0, 1) !== rows, 'estructura: mover entre hermanos de la misma seccion');
}
// ---- estructura: insertar y borrar ----
{
  const rows: PresupuestoRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),
    row({ tempId: 2, depth: 1 }),
    row({ tempId: 3, seccion: 'generales' }),
  ];
  const tras = insertRowAfter(rows, 0, 'item');
  ok(tras.length === 4 && tras[1].depth === 1, 'insertar: detras de una seccion entra como primer hijo');
  ok(tras[1].seccion === 'items', 'insertar: la seccion se hereda del ancla');
  ok(insertRowAfter(rows, 2, 'item')[3].seccion === 'generales', 'insertar: hereda tambien en Generales');

  const conItem = appendRow(rows, 'items', 'item');
  ok(conItem[2].seccion === 'items' && conItem[3].seccion === 'generales',
    'agregar: el renglon de items entra ANTES del bloque de Generales');
  ok(appendRow(rows, 'generales', 'item').length === 4, 'agregar: en Generales entra al final');

  ok(deleteSubtree(rows, 0).length === 1, 'borrar: se lleva la rama completa');
  ok(deleteSubtree(rows, 2).length === 2, 'borrar: una hoja se lleva solo su fila');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
