// Red de seguridad de la aritmetica de la curva de gasto.
// cd andrei-frontend && npx tsx scripts/curva-gasto.spec.ts
import {
  acumular, dominioCurva, escalonesY, hoyISO, marcasDeMes, toDay,
} from '../src/lib/curvaGasto';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++; else { failed++; console.log(`FAIL  ${label}`); }
}

// ---- fechas: ni un dia de corrimiento ----
{
  ok(toDay('1970-01-01') === 0, 'fecha: el dia 0 es el 1 de enero de 1970');
  ok(toDay('2026-01-02') - toDay('2026-01-01') === 1, 'fecha: dias seguidos van de uno en uno');
  ok(toDay('2026-03-01') - toDay('2026-02-01') === 28, 'fecha: febrero de 2026 tiene 28 dias');
  ok(toDay('2024-03-01') - toDay('2024-02-01') === 29, 'fecha: 2024 es bisiesto');
  ok(toDay('2027-01-01') - toDay('2026-01-01') === 365, 'fecha: un ano completo');

  // El caso que rompe todo en Panama (UTC-5): construir la fecha con el
  // constructor local corre el dia hacia atras.
  ok(hoyISO(new Date(2026, 8, 2, 0, 30)) === '2026-09-02',
    'fecha: hoy sale del calendario local, no de UTC');
  ok(hoyISO(new Date(2026, 8, 2, 23, 45)) === '2026-09-02',
    'fecha: a las once de la noche sigue siendo el mismo dia');
  ok(hoyISO(new Date(2026, 0, 5)) === '2026-01-05', 'fecha: mes y dia con cero delante');
}
// ---- acumulado ----
{
  const p = acumular([
    { fecha: '2026-01-10', monto: 100 },
    { fecha: '2026-02-10', monto: 50 },
    { fecha: '2026-03-10', monto: 25 },
  ]);
  ok(p.map((x) => x.acumulado).join(',') === '100,150,175', 'acumulado: cada pago suma al anterior');
  ok(p[2].monto === 25, 'acumulado: el monto del dia se conserva aparte');

  const desordenado = acumular([
    { fecha: '2026-03-10', monto: 25 },
    { fecha: '2026-01-10', monto: 100 },
    { fecha: '2026-02-10', monto: 50 },
  ]);
  ok(desordenado.map((x) => x.acumulado).join(',') === '100,150,175',
    'acumulado: se ordena por fecha aunque llegue revuelto');
  ok(acumular([]).length === 0, 'acumulado: sin pagos no hay puntos');
}
// ---- escalones del eje de plata ----
{
  const e = escalonesY(1000);
  ok(e[0] === 0, 'eje: siempre arranca en cero');
  ok(e[e.length - 1] >= 1000, 'eje: el ultimo escalon cubre el maximo');
  ok(e.length >= 4 && e.length <= 9, 'eje: entre cuatro y ocho escalones');
  ok(escalonesY(142686.2).every((v) => Number.isFinite(v)), 'eje: numeros reales, no NaN');
  const redondos = escalonesY(142686.2);
  ok(redondos[1] === 25000, 'eje: los escalones son redondos (25k), no el maximo partido');
  ok(redondos[redondos.length - 1] > 142686.2, 'eje: hay una marca POR ENCIMA del presupuesto');
  ok(escalonesY(0).join(',') === '0' && escalonesY(-5).join(',') === '0',
    'eje: sin plata el eje es solo el cero');
}
// ---- dominio ----
{
  const hoy = toDay('2026-09-02');
  const puntos = acumular([
    { fecha: '2026-05-10', monto: 1000 },
    { fecha: '2026-07-01', monto: 500 },
  ]);
  const d = dominioCurva(puntos, 5000, '2026-04-15', '2026-12-31', hoy);
  ok(d.d0 === toDay('2026-04-15'), 'dominio: arranca en el inicio de la obra');
  ok(d.d1 === toDay('2026-12-31'), 'dominio: termina en el fin previsto');
  ok(d.gastado === 1500, 'dominio: el gastado es el ultimo acumulado');
  ok(d.yMax >= 5000, 'dominio: el eje cubre el presupuesto');

  // Un pago fuera del plazo no se puede quedar fuera del cuadro.
  const tarde = dominioCurva(
    acumular([{ fecha: '2027-02-01', monto: 10 }]), 100, '2026-04-15', '2026-12-31', hoy,
  );
  ok(tarde.d1 === toDay('2027-02-01'), 'dominio: un pago despues del fin estira el eje');

  const temprano = dominioCurva(
    acumular([{ fecha: '2026-01-01', monto: 10 }]), 100, '2026-04-15', '2026-12-31', hoy,
  );
  ok(temprano.d0 === toDay('2026-01-01'), 'dominio: un pago antes del inicio estira el eje');

  // Sin fechas de proyecto y sin pagos el dominio sigue siendo dibujable.
  const vacio = dominioCurva([], null, null, null, hoy);
  ok(vacio.span >= 1, 'dominio: sin datos el ancho nunca es cero');
  ok(vacio.gastado === 0 && vacio.yMax >= 1, 'dominio: sin datos el eje sigue teniendo tope');

  // El gastado manda sobre el presupuesto cuando se pasa: la curva no puede
  // salirse del cuadro por arriba.
  const pasado = dominioCurva(acumular([{ fecha: '2026-05-10', monto: 9000 }]), 5000, null, null, hoy);
  ok(pasado.yMax >= 9000, 'dominio: si el gasto pasa el presupuesto, el eje lo sigue');
}

// ---- marcas del eje de tiempo ----
{
  // Obra de un año: solo el mes, sin año, que no hace falta.
  const corta = marcasDeMes(toDay('2026-04-15'), toDay('2026-12-31'));
  ok(corta.length >= 7 && corta.length <= 12, 'meses: una obra de un año cabe sin saltarse marcas');
  ok(corta.every((m) => !/\d/.test(m.texto)), 'meses: dentro del mismo año no se escribe el año');
  ok(corta[0].texto === 'May', 'meses: la primera marca es el primero de mes que cae dentro');

  // Obra de cuatro años: se ralean y el año aparece SOLO cuando cambia.
  const larga = marcasDeMes(toDay('2026-01-01'), toDay('2029-12-31'));
  ok(larga.length <= 12, 'meses: cuatro años siguen cabiendo en doce marcas');
  const conAnio = larga.filter((m) => /\d/.test(m.texto));
  ok(conAnio.length === 4, 'meses: el año se escribe una vez por año, no en cada marca');
  ok(larga[0].texto === 'Ene 26', 'meses: la primera marca lleva el año');
  ok(conAnio.map((m) => m.texto.slice(-2)).join(',') === '26,27,28,29',
    'meses: los años salen en orden y sin repetirse');

  ok(marcasDeMes(toDay('2026-05-02'), toDay('2026-05-20')).length === 0,
    'meses: si no cae ningún primero de mes, no hay marcas');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
