// Golden gate for the desglose model + paste parser + API tree reconstruction.
// cd andrei-frontend && npx tsx scripts/desglose.spec.ts
import './desgloseSpecEnv'; // MUST be first: stubs window before desgloseApi loads @/services/api
import {
  computeTotals, toWireItems, indentLegal, outdentLegal, GRAND_TOTAL_KEY, type DesgloseRow,
} from '../src/lib/desgloseModel';
import { parseDesglosePaste, parseMoney } from '../src/lib/desglosePaste';
import { wireToRows, type DesgloseItemWire } from '../src/lib/desgloseApi';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++; else { failed++; console.log(`FAIL  ${label}`); }
}
const row = (over: Partial<DesgloseRow>): DesgloseRow => ({
  tempId: 0, depth: 0, tipo: 'item', item: '', descripcion: '', unidad: null,
  cantidad: null, precioUnitario: null, ...over,
});

// ---- model: totals ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo', descripcion: 'Cap 1' }),
    row({ tempId: 2, depth: 1, cantidad: 10, precioUnitario: 2.5 }),   // 25
    row({ tempId: 3, depth: 1, tipo: 'grupo', descripcion: 'Sub' }),
    row({ tempId: 4, depth: 2, cantidad: 4, precioUnitario: 0.25 }),   // 1
    row({ tempId: 5, cantidad: 1, precioUnitario: 100 }),              // root item, 100
  ];
  const t = computeTotals(rows);
  ok(t.get(2) === 25 && t.get(4) === 1, 'totals: item = cantidad × PU');
  ok(t.get(3) === 1, 'totals: subgrupo acumula su subárbol');
  ok(t.get(1) === 26, 'totals: grupo acumula subgrupos e items');
  ok(Math.abs((t.get(GRAND_TOTAL_KEY) ?? 0) - 126) < 1e-9, 'totals: gran total bajo GRAND_TOTAL_KEY');
}
// ---- model: wire conversion ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),
    row({ tempId: 2, depth: 1 }),
    row({ tempId: 3 }),
  ];
  const wire = toWireItems(rows);
  ok(wire[0].parentTempId === null && wire[1].parentTempId === 1 && wire[2].parentTempId === null,
    'wire: parentTempId por profundidad');
  ok(wire.map((w) => w.orden).join(',') === '0,1,2', 'wire: orden = índice de documento');
}
// ---- model: indent legality ----
{
  const rows: DesgloseRow[] = [row({ tempId: 1 }), row({ tempId: 2 })];
  ok(!indentLegal(rows, 0), 'indent: fila 0 nunca');
  ok(indentLegal(rows, 1), 'indent: bajo la anterior sí');
  ok(!outdentLegal(rows, 1), 'outdent: en profundidad 0 no');
}
// ---- paste: WBS numeric codes ----
{
  const tsv = [
    '1\tMovimiento de tierra\t\t\t',
    '1.1\tExcavación\tm3\t100\t5.50',
    '1.2\tRelleno\tm3\t80\t7.25',
    '2\tTuberías\t\t\t',
    '2.1\tPVC 6"\tml\t1,200\t$12.75',
  ].join('\n');
  const r = parseDesglosePaste(tsv, 'codigos');
  ok(r.rows.length === 5, 'paste: 5 filas');
  ok(r.rows[0].tipo === 'grupo' && r.rows[3].tipo === 'grupo', 'paste: sin cantidad+PU = grupo');
  ok(r.rows[1].depth === 1 && r.rows[4].depth === 1, 'paste: profundidad por código 1.1/2.1');
  ok(r.rows[4].cantidad === 1200 && r.rows[4].precioUnitario === 12.75, 'paste: tolera miles y $');
}
// ---- paste: letter codes A1/A1.1 ----
{
  const tsv = ['A1\tGeneral\t\t\t', 'A1.1\tOficina\tmes\t12\t800', 'A2\tObra civil\t\t\t', 'A2.1\tLosa\tm2\t50\t35'].join('\n');
  const r = parseDesglosePaste(tsv, 'codigos');
  ok(r.rows[1].depth === 1 && r.rows[3].depth === 1, 'paste: códigos con letras anidan');
  ok(r.rows[0].depth === 0 && r.rows[2].depth === 0, 'paste: raíces con letras');
}
// ---- paste: 1.01 style stays sibling, not child of a fake "1" ----
{
  const tsv = ['1.01\tPartida uno\tgl\t1\t1000', '1.02\tPartida dos\tgl\t1\t2000'].join('\n');
  const r = parseDesglosePaste(tsv, 'codigos');
  ok(r.rows[0].depth === 0 && r.rows[1].depth === 0, 'paste: prefijo sin fila padre real queda plano');
}
// ---- paste: flat mode + total mismatch flag ----
{
  const tsv = ['1.1\tExcavación\tm3\t3\t3.33\t10.00'].join('\n');
  const r = parseDesglosePaste(tsv, 'plano');
  ok(r.rows[0].depth === 0, 'paste plano: todo a profundidad 0');
  ok(r.rows[0].totalMismatch === true, 'paste: 3×3.33=9.99 ≠ 10.00 marcado');
}
// ---- paste: header row skipped ----
{
  const tsv = ['ITEM\tDESCRIPCIÓN\tUNIDAD\tCANTIDAD\tP.U.', '1\tPartida\tgl\t1\t5'].join('\n');
  const r = parseDesglosePaste(tsv, 'codigos');
  ok(r.rows.length === 1 && r.rows[0].descripcion === 'Partida', 'paste: encabezado detectado y omitido');
}

// ---- parseMoney: currency tokens, thousands dots, accounting negatives ----
{
  ok(parseMoney('B/. 1,200.50') === 1200.5, 'money: B/. con miles y decimales');
  ok(parseMoney('B/. 5') === 5, 'money: B/. entero');
  ok(parseMoney('1.234.567') === 1234567, 'money: multipunto sin coma = miles');
  ok(parseMoney('(1,200.50)') === -1200.5, 'money: paréntesis contables = negativo');
  ok(parseMoney('12.345') === 12.345, 'money: un solo punto sigue siendo decimal');
}
// ---- paste: an 'item' can never be a paste parent — child demoted to sibling ----
{
  const tsv = ['1\tMovilización\tgl\t1\t100', '1.1\tSub\tgl\t2\t50'].join('\n');
  const r = parseDesglosePaste(tsv, 'codigos');
  ok(r.rows[1].depth === 0, 'paste: hijo de un item se degrada a hermano (depth 0)');
  ok(r.rows[0].cantidad === 1 && r.rows[0].precioUnitario === 100
    && r.rows[1].cantidad === 2 && r.rows[1].precioUnitario === 50,
    'paste: degradar no destruye montos');
}
// ---- paste: depth jumps + codeless rows normalize to a legal tree ----
{
  const tsv = [
    '1\tCap\t\t\t',
    '1.1\tA\tgl\t1\t10',
    '\tsuelto\tgl\t1\t5',
    '1.1.1\tB\tgl\t1\t20',
  ].join('\n');
  const r = parseDesglosePaste(tsv, 'codigos');
  ok(r.rows.length === 4, 'paste normaliza: 4 filas');
  let legal = true; let prevDepth = -1;
  for (const rw of r.rows) { if (rw.depth > prevDepth + 1) legal = false; prevDepth = rw.depth; }
  ok(legal, 'paste normaliza: depth ≤ prevDepth+1 en todas las filas');
  const wire = toWireItems(r.rows);
  const grupoIds = new Set(r.rows.filter((x) => x.tipo === 'grupo').map((x) => x.tempId));
  ok(wire.every((w) => w.parentTempId === null || grupoIds.has(w.parentTempId)),
    'paste normaliza: ningún padre estructural es un item');
  ok(wire.every((w, i) => r.rows[i].depth === 0 || w.parentTempId !== null),
    'paste normaliza: depth>0 siempre tiene padre no-nulo');
}
// ---- paste: money-only row (no code, no description) is kept ----
{
  const r = parseDesglosePaste('\t\tgl\t2\t50', 'codigos');
  ok(r.rows.length === 1 && r.rows[0].tipo === 'item'
    && r.rows[0].item === '' && r.rows[0].descripcion === '',
    'paste: fila solo-montos no se descarta');
}

// ---- api: wire round-trip ----
{
  const rows = wireToRows([
    { id: 10, parentId: null, tipo: 'grupo', item: '1', descripcion: 'Cap', unidad: null, cantidad: null, precioUnitario: null, orden: 0 },
    { id: 11, parentId: 10, tipo: 'item', item: '1.1', descripcion: 'Sub', unidad: 'gl', cantidad: 1, precioUnitario: 5, orden: 1 },
  ] satisfies DesgloseItemWire[]);
  ok(rows.length === 2 && rows[1].depth === 1, 'wireToRows: profundidad reconstruida');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
