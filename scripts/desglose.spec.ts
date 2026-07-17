// Golden gate for the desglose model + paste parser + API tree reconstruction.
// cd andrei-frontend && npx tsx scripts/desglose.spec.ts
import './desgloseSpecEnv'; // MUST be first: stubs window before desgloseApi loads @/services/api
import {
  computeTotals, toWireItems, indentLegal, outdentLegal, moveSubtree, canMoveSubtree,
  subtreeEnd, indentRows, indentParentIndex, outdentRows, deleteSubtree, insertRowAfter,
  GRAND_TOTAL_KEY, type DesgloseRow,
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
// ---- api: sibling order relies on the per-group orden sort (input shuffled on purpose) ----
{
  const wireRow = (id: number, parentId: number | null, tipo: 'grupo' | 'item', orden: number): DesgloseItemWire =>
    ({ id, parentId, tipo, item: String(id), descripcion: '', unidad: null, cantidad: null, precioUnitario: null, orden });
  const rows = wireToRows([
    wireRow(4, 3, 'item', 3),
    wireRow(1, null, 'grupo', 0),
    wireRow(3, null, 'grupo', 2),
    wireRow(2, 1, 'item', 1),
  ]);
  ok(rows.map((r) => r.tempId).join(',') === '1,2,3,4', 'wireToRows: orden de hermanos restaurado desde entrada desordenada');
  ok(rows.map((r) => r.depth).join(',') === '0,1,0,1', 'wireToRows: profundidades de dos grupos raíz');
}

// ---- model: moveSubtree ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),            // 0: grupo A
    row({ tempId: 2, depth: 1 }),                 // 1:   item A.1
    row({ tempId: 3, depth: 1, tipo: 'grupo' }),  // 2:   grupo A.B
    row({ tempId: 4, depth: 2 }),                 // 3:     item A.B.1
    row({ tempId: 5, depth: 1 }),                 // 4:   item A.2
    row({ tempId: 6, tipo: 'grupo' }),            // 5: grupo C
  ];
  const up = moveSubtree(rows, 2, -1); // A.B (+ child) above A.1
  ok(up.map((r) => r.tempId).join(',') === '1,3,4,2,5,6', 'moveSubtree: sube subárbol completo');
  const down = moveSubtree(rows, 2, 1); // A.B (+ child) below A.2
  ok(down.map((r) => r.tempId).join(',') === '1,2,5,3,4,6', 'moveSubtree: baja subárbol completo');
  ok(moveSubtree(rows, 1, -1) === rows, 'moveSubtree: primer hijo no sube');
  ok(moveSubtree(rows, 4, 1) === rows, 'moveSubtree: último hijo no baja (no cruza al grupo C)');
  ok(moveSubtree(rows, 5, 1) === rows, 'moveSubtree: última raíz no baja');
}

// ---- model: subtreeEnd ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),            // 0: G
    row({ tempId: 2, depth: 1 }),                 // 1:   item
    row({ tempId: 3, depth: 1, tipo: 'grupo' }),  // 2:   subgrupo
    row({ tempId: 4, depth: 2 }),                 // 3:     item
    row({ tempId: 5 }),                           // 4: item raíz
  ];
  ok(subtreeEnd(rows, 0) === 4, 'subtreeEnd: grupo incluye todo su subárbol');
  ok(subtreeEnd(rows, 2) === 4, 'subtreeEnd: subgrupo incluye a su hijo');
  ok(subtreeEnd(rows, 4) === 5, 'subtreeEnd: hoja = i+1');
}
// ---- model: outdentRows — item con seguidor a la misma profundidad es ilegal ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),  // 0: G
    row({ tempId: 2, depth: 1 }),       // 1:   A item
    row({ tempId: 3, depth: 1 }),       // 2:   B item
  ];
  ok(outdentRows(rows, 1) === rows, 'outdentRows: item con hermano siguiente no sale (B quedaría bajo un item)');
  const last = outdentRows(rows, 2);
  ok(last !== rows && last.map((r) => r.depth).join(',') === '0,1,0', 'outdentRows: último hijo sí sale');
  ok(outdentRows(rows, 0) === rows, 'outdentRows: profundidad 0 no sale');
}
// ---- model: outdentRows — grupo adopta a los seguidores (semántica MS-Project) ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),            // 0: G
    row({ tempId: 2, depth: 1, tipo: 'grupo' }),  // 1:   A grupo
    row({ tempId: 3, depth: 1 }),                 // 2:   B item
  ];
  const out = outdentRows(rows, 1);
  ok(out !== rows && out.map((r) => r.tempId).join(',') === '1,2,3', 'outdentRows: adopción no reordena filas');
  ok(out.map((r) => r.depth).join(',') === '0,0,1', 'outdentRows: B queda adoptado bajo A');
  const wire = toWireItems(out);
  ok(wire[0].parentTempId === null && wire[1].parentTempId === null && wire[2].parentTempId === 2,
    'outdentRows: padres G:null, A:null, B:A');
}
// ---- model: indentRows ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1 }),                 // 0: item raíz
    row({ tempId: 2, tipo: 'grupo' }),  // 1: grupo raíz
    row({ tempId: 3 }),                 // 2: item raíz
  ];
  ok(indentRows(rows, 0) === rows, 'indentRows: fila 0 nunca');
  ok(indentParentIndex(rows, 2) === 1, 'indentParentIndex: hermano anterior es el nuevo padre');
  const ind = indentRows(rows, 2);
  ok(ind !== rows && ind.map((r) => r.depth).join(',') === '0,0,1', 'indentRows: bajo un grupo indenta');
  const rows2: DesgloseRow[] = [row({ tempId: 1 }), row({ tempId: 2 })];
  ok(indentRows(rows2, 1) === rows2, 'indentRows: padre item exige promoción (misma referencia)');
  const rows3: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),
    row({ tempId: 2, tipo: 'grupo' }),
    row({ tempId: 3, depth: 1 }),
  ];
  const ind3 = indentRows(rows3, 1);
  ok(ind3 !== rows3 && ind3.map((r) => r.depth).join(',') === '0,1,2', 'indentRows: subárbol completo +1');
}
// ---- model: deleteSubtree — grupo intermedio deja un árbol legal ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),            // 0: G
    row({ tempId: 2, depth: 1, tipo: 'grupo' }),  // 1:   X grupo (intermedio)
    row({ tempId: 3, depth: 2 }),                 // 2:     X.1
    row({ tempId: 4, depth: 1 }),                 // 3:   S seguidor
  ];
  const del = deleteSubtree(rows, 1);
  ok(del.map((r) => r.tempId).join(',') === '1,4', 'deleteSubtree: sale el subárbol completo');
  let legal = true; let prev = -1;
  for (const r of del) { if (r.depth > prev + 1) legal = false; prev = r.depth; }
  ok(legal, 'deleteSubtree: invariante de profundidad intacto en los seguidores');
  ok(toWireItems(del)[1].parentTempId === 1, 'deleteSubtree: el seguidor sigue bajo G');
  ok(deleteSubtree(rows, 3).length === 3, 'deleteSubtree: hoja elimina solo una fila');
}
// ---- model: insertRowAfter — depth sigue al ancla, invariante intacto ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),  // 0: G
    row({ tempId: 2, depth: 1 }),       // 1:   G.1 item
    row({ tempId: 3, tipo: 'item' }),   // 2: item raíz
  ];
  const legal = (rs: DesgloseRow[]) => { let prev = -1, okk = true; for (const r of rs) { if (r.depth > prev + 1) okk = false; prev = r.depth; } return okk; };

  const a = insertRowAfter(rows, 1, 'item');            // tras un item -> hermano
  ok(a.length === 4 && a[2].depth === 1 && a[2].tipo === 'item', 'insert: tras item = hermano (misma profundidad)');
  ok(a[2].tempId === 4, 'insert: tempId nuevo = max+1');
  ok(toWireItems(a)[2].parentTempId === 1, 'insert: el hermano nuevo queda bajo el mismo grupo');

  const b = insertRowAfter(rows, 0, 'item');            // tras un grupo -> primer hijo
  ok(b[1].depth === 1 && b[1].tipo === 'item', 'insert: tras grupo = primer hijo (profundidad+1)');
  ok(toWireItems(b)[1].parentTempId === 1, 'insert: el hijo nuevo queda dentro del grupo');

  const c = insertRowAfter(rows, 2, 'grupo');           // grupo nuevo tras item raíz
  ok(c[3].tipo === 'grupo' && c[3].depth === 0, 'insert: grupo nuevo tras item raíz al nivel del item');

  ok(legal(a) && legal(b) && legal(c), 'insert: invariante de profundidad intacto');
  ok(insertRowAfter(rows, 9, 'item') === rows, 'insert: índice fuera de rango = misma referencia');
}
// ---- model: canMoveSubtree coincide con la identidad de moveSubtree ----
{
  const rows: DesgloseRow[] = [
    row({ tempId: 1, tipo: 'grupo' }),            // 0: grupo A
    row({ tempId: 2, depth: 1 }),                 // 1:   item A.1
    row({ tempId: 3, depth: 1, tipo: 'grupo' }),  // 2:   grupo A.B
    row({ tempId: 4, depth: 2 }),                 // 3:     item A.B.1
    row({ tempId: 5, depth: 1 }),                 // 4:   item A.2
    row({ tempId: 6, tipo: 'grupo' }),            // 5: grupo C
  ];
  const cases: [number, -1 | 1][] = [[2, -1], [2, 1], [1, -1], [4, 1], [5, 1]];
  ok(cases.every(([i, d]) => canMoveSubtree(rows, i, d) === (moveSubtree(rows, i, d) !== rows)),
    'canMoveSubtree: coincide con moveSubtree en los 5 casos existentes');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
