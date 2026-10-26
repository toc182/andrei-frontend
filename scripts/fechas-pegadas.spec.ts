// Golden gate for the dates a person pastes or types in petty cash (and the cronograma):
// everything Excel in Panama tends to hand over, read as the day it means.
// cd andrei-frontend && npx tsx scripts/fechas-pegadas.spec.ts
import { parseSingleDate, parseDateColumn, leerCelda, leerColumna } from '../src/lib/fechasPegadas';

let passed = 0; let failed = 0;
function lee(raw: string, want: string, label = raw) {
  const r = parseSingleDate(raw, 'dmy');
  const got = r.ok ? r.value : `✗ ${r.reason}`;
  if (got === want) passed++; else { failed++; console.log(`FAIL  «${label}»: got ${got}, want ${want}`); }
}
function noLee(raw: string, label = raw) {
  const r = parseSingleDate(raw, 'dmy');
  if (!r.ok && !r.blank) passed++; else { failed++; console.log(`FAIL  «${label}» should not be read (got ${JSON.stringify(r)})`); }
}

// ---- how the system writes it, and how Excel in Panama shows it ----
lee('07/oct/2026', '2026-10-07');
lee('7/oct/2026', '2026-10-07');
lee('07-oct-26', '2026-10-07');
lee('7-oct-26', '2026-10-07');
lee('7 oct 2026', '2026-10-07');
lee('07 oct. 2026', '2026-10-07');
lee('7-Oct-2026', '2026-10-07', 'month capitalised');
lee('07/OCT/2026', '2026-10-07', 'month in capitals');
lee('7 de octubre de 2026', '2026-10-07');
lee('07/10/2026', '2026-10-07', 'day first by default');
lee('7/10/26', '2026-10-07', 'two-digit year');
lee('07.10.2026', '2026-10-07', 'dots');
lee('07-10-2026', '2026-10-07', 'dashes');
lee('2026-10-07', '2026-10-07', 'ISO');
lee('2026/10/07', '2026-10-07', 'year first with slashes');
lee('  07/10/2026  ', '2026-10-07', 'spaces around');

// ---- September, every way people write it ----
lee('15/sep/2026', '2026-09-15');
lee('15/sept/2026', '2026-09-15');
lee('15-set-26', '2026-09-15');
lee('15 de septiembre de 2026', '2026-09-15');
lee('15 de setiembre de 2026', '2026-09-15');

// ---- English Excel ----
lee('7-Oct-26', '2026-10-07');
lee('Oct 7, 2026', '2026-10-07', 'month first with a comma');
lee('7-Aug-2026', '2026-08-07');
lee('7 Jan 2026', '2026-01-07');

// ---- a date copied with its time ----
lee('07/10/2026 0:00', '2026-10-07', 'with 0:00');
lee('07/10/2026 15:05', '2026-10-07', 'with a 24-hour time');
lee('07/10/2026 3:05 p. m.', '2026-10-07', 'with p. m.');
lee('07/oct/2026 3:05 p. m.', '2026-10-07', 'as the system writes a moment');
lee('2026-10-07 15:05:00', '2026-10-07', 'ISO with seconds');

// ---- what cannot be a date, and must stay red instead of becoming another day ----
noLee('31/02/2026', 'February 31');
noLee('29/02/2026', 'February 29 in a non-leap year');
lee('29/02/2028', '2028-02-29', 'February 29 in a leap year');
noLee('32/01/2026');
noLee('07/13/2026', 'month 13 when read day first');
noLee('45678', 'an Excel serial number');
noLee('mañana');
noLee('07/xyz/2026', 'unknown month');
noLee('7/10', 'no year');

// ---- blank is not an error ----
{
  const r = parseSingleDate('   ', 'dmy');
  if (!r.ok && r.blank) passed++; else { failed++; console.log('FAIL  blank should be blank'); }
}

// ---- a pasted column decides dd/mm vs mm/dd once ----
{
  const col = parseDateColumn(['05/04/2026', '25/04/2026', '06/04/2026'], 'dmy');
  const v = col.results.map((r) => (r.ok ? r.value : '✗'));
  if (v.join() === '2026-04-05,2026-04-25,2026-04-06') passed++; else { failed++; console.log(`FAIL  day-first column: ${v.join()}`); }
}
{
  // An English export: one cell can only be month first, so the whole column is.
  const col = parseDateColumn(['04/05/2026', '04/25/2026', '04/06/2026'], 'dmy');
  const v = col.results.map((r) => (r.ok ? r.value : '✗'));
  if (v.join() === '2026-04-05,2026-04-25,2026-04-06' && col.resolvedOrder === 'mdy') passed++;
  else { failed++; console.log(`FAIL  month-first column: ${v.join()} (${col.resolvedOrder})`); }
}
{
  // All ambiguous: read day first, as in Panama.
  const col = parseDateColumn(['05/04/2026', '06/04/2026'], 'dmy');
  const v = col.results.map((r) => (r.ok ? r.value : '✗'));
  if (v.join() === '2026-04-05,2026-04-06') passed++; else { failed++; console.log(`FAIL  ambiguous column: ${v.join()}`); }
}

// ---- what the petty cash cell keeps ----
{
  const ok = leerCelda('7/10/26');
  const mal = leerCelda(' 31/02/2026 ');
  const vacia = leerCelda('');
  if (ok.fecha === '2026-10-07' && !ok.cruda) passed++; else { failed++; console.log(`FAIL  cell read: ${JSON.stringify(ok)}`); }
  if (mal.fecha === '' && mal.cruda === '31/02/2026' && /día inválido/.test(mal.motivo ?? '')) passed++;
  else { failed++; console.log(`FAIL  cell keeps what it could not read: ${JSON.stringify(mal)}`); }
  if (vacia.fecha === '' && !vacia.cruda) passed++; else { failed++; console.log(`FAIL  blank cell: ${JSON.stringify(vacia)}`); }
  const col = leerColumna(['04/25/2026', '04/05/2026', 'xx']);
  if (col[0].fecha === '2026-04-25' && col[1].fecha === '2026-04-05' && col[2].cruda === 'xx') passed++;
  else { failed++; console.log(`FAIL  pasted column: ${JSON.stringify(col)}`); }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
