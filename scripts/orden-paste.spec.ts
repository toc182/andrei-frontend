// Golden gate for pasting Excel cells straight into a purchase order's rows.
// cd andrei-frontend && npx tsx scripts/orden-paste.spec.ts
import { pegarEnRenglones, type RenglonTexto } from '../src/lib/ordenPaste';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++; else { failed++; console.log(`FAIL  ${label}`); }
}
const vacio = (): RenglonTexto => ({ cantidad: '', unidad: 'unidad', descripcion: '', precio_unitario: '' });

// ---- the form's order, with a header and a Total column, into the first empty row ----
{
  const r = pegarEnRenglones(
    [vacio()],
    0,
    'cantidad',
    'Cant.\tUnidad\tDescripción\tP. Unit.\tTotal\n' +
      '300\tqq\tVarilla #4 grado 60, 30 pies\t$38.50\t$11,550.00\n' +
      '1,200\tsaco\tCemento gris, saco de 42.5 kg\t8.75\t10,500.00\r\n',
    vacio,
  )!;
  ok(r.length === 2, `header skipped, two rows (got ${r.length})`);
  ok(r[0].cantidad === '300' && r[0].unidad === 'qq', 'quantity and unit');
  ok(r[0].precio_unitario === '38.5', 'price with $ cleaned to 38.5');
  ok(r[1].cantidad === '1200', '"1,200" is twelve hundred');
  ok(r[1].descripcion === 'Cemento gris, saco de 42.5 kg', 'description');
}

// ---- pasting lower down overwrites from there and adds rows as needed ----
{
  const antes = [
    { cantidad: '1', unidad: 'unidad', descripcion: 'Ya escrito', precio_unitario: '5' },
    vacio(),
  ];
  const r = pegarEnRenglones(antes, 1, 'cantidad', '10\tm\tCable\t1.15\n5\tunidad\tBreaker\t28.50', vacio)!;
  ok(r.length === 3, `one row added (got ${r.length})`);
  ok(r[0].descripcion === 'Ya escrito', 'the row above is untouched');
  ok(r[1].descripcion === 'Cable' && r[2].descripcion === 'Breaker', 'rows filled in order');
  ok(antes[1].descripcion === '', 'the original array is not mutated');
}

// ---- starting at Descripción: only Descripción and P. unit. are filled ----
{
  const antes = [{ cantidad: '3', unidad: 'caja', descripcion: '', precio_unitario: '' }];
  const r = pegarEnRenglones(antes, 0, 'descripcion', 'Tornillo 1/2"\t18.90\t56.70', vacio)!;
  ok(r[0].cantidad === '3' && r[0].unidad === 'caja', 'columns to the left are kept');
  ok(r[0].descripcion === 'Tornillo 1/2"' && r[0].precio_unitario === '18.9', 'description and price, total ignored');
}

// ---- a single text cell is left to the browser; a single number is cleaned ----
{
  ok(pegarEnRenglones([vacio()], 0, 'descripcion', 'Arena de río', vacio) === null, 'single text cell: browser pastes');
  const r = pegarEnRenglones([vacio()], 0, 'precio_unitario', 'B/. 42,00', vacio)!;
  ok(r[0].precio_unitario === '42', 'single number cell cleaned');
}

// ---- multi-line cell, blank and subtotal-only rows ----
{
  const r = pegarEnRenglones(
    [vacio()],
    0,
    'cantidad',
    '40\trollo\t"Alambre de amarre\n#16"\t34\t1,360.00\n\t\t\t\t\n\t\t\t\t1,360.00\n',
    vacio,
  )!;
  ok(r.length === 1, `blank and subtotal-only rows do not become rows (got ${r.length})`);
  ok(r[0].descripcion === 'Alambre de amarre #16', 'multi-line cell joined');
}

// ---- unreadable numbers stay empty; empty unit becomes «unidad» ----
{
  const r = pegarEnRenglones([vacio()], 0, 'cantidad', 'varios\t\tLija\tconsultar', vacio)!;
  ok(r[0].cantidad === '' && r[0].precio_unitario === '', 'unreadable numbers stay empty to fill in');
  ok(r[0].unidad === 'unidad', 'empty unit becomes «unidad», like a new row');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
