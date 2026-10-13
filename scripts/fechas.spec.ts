// Golden gate for how every screen writes a date: «07/oct/2026», «07/oct/2026 3:05 p. m.».
// cd andrei-frontend && npx tsx scripts/fechas.spec.ts
import { fecha, fechaDeMomento, fechaHora } from '../src/lib/fechas';

let passed = 0; let failed = 0;
function eq(got: string, want: string, label: string) {
  if (got === want) passed++; else { failed++; console.log(`FAIL  ${label}: got «${got}», want «${want}»`); }
}
function ok(cond: boolean, label: string) {
  if (cond) passed++; else { failed++; console.log(`FAIL  ${label}`); }
}

// ---- a calendar day (a DATE column), however the server sends it ----
eq(fecha('2026-10-07'), '07/oct/2026', 'plain YYYY-MM-DD');
// The live server runs in UTC: a DATE leaves it as midnight UTC, which in Panama is
// still the day before at 7 p. m. It must stay the 7th.
eq(fecha('2026-10-07T00:00:00.000Z'), '07/oct/2026', 'DATE sent by a UTC server');
// A server in Panama time sends the same day as 05:00 UTC.
eq(fecha('2026-10-07T05:00:00.000Z'), '07/oct/2026', 'DATE sent by a Panama server');
eq(fecha('2026-09-01'), '01/sep/2026', 'September is «sep», not «sept»');
eq(fecha('2026-12-31'), '31/dic/2026', 'last day of the year');
eq(fecha('2027-01-01'), '01/ene/2027', 'first day of the year');
eq(fecha('2028-02-29'), '29/feb/2028', 'leap day');
const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
meses.forEach((m, i) =>
  eq(fecha(`2026-${String(i + 1).padStart(2, '0')}-15`), `15/${m}/2026`, `month ${i + 1}`),
);
// A Date built on screen (today, a day picked in a calendar) is read as the day it shows.
eq(fecha(new Date(2026, 9, 7)), '07/oct/2026', 'a local Date object');
eq(fecha(new Date(2026, 9, 7, 23, 59)), '07/oct/2026', 'a local Date late at night');

// ---- nothing to show ----
eq(fecha(null), '—', 'null');
eq(fecha(undefined), '—', 'undefined');
eq(fecha(''), '—', 'empty string');
eq(fecha('no es fecha'), '—', 'garbage');
eq(fecha(null, '-'), '-', 'the screen chooses its own blank');
eq(fechaHora(null), '—', 'moment null');
eq(fechaDeMomento(undefined), '—', 'moment undefined');

// ---- a moment (created_at, approved at…), always in Panama time ----
// 9:05 p. m. in Panama on the 7th is already 02:05 of the 8th in UTC.
eq(fechaDeMomento('2026-10-08T02:05:00.000Z'), '07/oct/2026', 'night moment stays on its Panama day');
eq(fechaHora('2026-10-08T02:05:00.000Z'), '07/oct/2026 9:05 p. m.', 'night moment with time');
eq(fechaHora('2026-10-07T20:05:00.000Z'), '07/oct/2026 3:05 p. m.', 'afternoon');
eq(fechaHora('2026-10-07T13:30:00.000Z'), '07/oct/2026 8:30 a. m.', 'morning');
eq(fechaHora('2026-10-07T05:00:00.000Z'), '07/oct/2026 12:00 a. m.', 'midnight is 12 a. m.');
eq(fechaHora('2026-10-07T17:00:00.000Z'), '07/oct/2026 12:00 p. m.', 'noon is 12 p. m.');
eq(fechaHora('2026-10-07T16:59:00.000Z'), '07/oct/2026 11:59 a. m.', 'just before noon');
eq(fechaHora('2026-10-07T20:05:09.123456Z'), '07/oct/2026 3:05 p. m.', 'seconds and micros dropped');
eq(fechaHora('2026-10-07T15:05:00-05:00'), '07/oct/2026 3:05 p. m.', 'an offset written out');
eq(fechaHora(new Date(Date.UTC(2026, 9, 7, 20, 5))), '07/oct/2026 3:05 p. m.', 'a Date object');
// The space before «p. m.» must be a plain one, so copying the text into Excel is clean.
ok(!/[\u00a0\u202f]/.test(fechaHora('2026-10-07T20:05:00.000Z')), 'no hidden spaces');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
