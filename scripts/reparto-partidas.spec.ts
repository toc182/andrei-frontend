// Red de seguridad del reparto proporcional de un gasto general.
// cd andrei-frontend && npx tsx scripts/reparto-partidas.spec.ts
import { repartirEntre, repartirProporcional, type PartidaConPeso } from '../src/lib/repartoPartidas';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++; else { failed++; console.log(`FAIL  ${label}`); }
}

const p = (rowUid: string, presupuestado: number | null): PartidaConPeso => ({ rowUid, presupuestado });
const suma = (l: { monto: number }[]) => Math.round(l.reduce((s, x) => s + x.monto, 0) * 100);

// ---- los dos ejemplos que puso Ivan ----
{
  // Diez lineas de 1$ y un extintor de 10$: 1$ a cada una.
  const diez = Array.from({ length: 10 }, (_, i) => p(`r${i}`, 1));
  const r = repartirProporcional(diez, 10);
  ok(r.length === 10, 'ejemplo 1: le toca a las diez lineas');
  ok(r.every((x) => x.monto === 1), 'ejemplo 1: un dolar a cada una');
  ok(suma(r) === 1000, 'ejemplo 1: la suma da el monto del pago');

  // 2 lineas de 2$, 4 de 1$ y 4 de 0.5$ (total 10$), extintor de 1$:
  // 0.20, 0.10 y 0.05 respectivamente.
  const mezcla = [
    ...Array.from({ length: 2 }, (_, i) => p(`a${i}`, 2)),
    ...Array.from({ length: 4 }, (_, i) => p(`b${i}`, 1)),
    ...Array.from({ length: 4 }, (_, i) => p(`c${i}`, 0.5)),
  ];
  const m = repartirProporcional(mezcla, 1);
  const por = new Map(m.map((x) => [x.rowUid, x.monto]));
  ok(por.get('a0') === 0.2 && por.get('a1') === 0.2, 'ejemplo 2: las de 2$ cargan 0.20');
  ok([0, 1, 2, 3].every((i) => por.get(`b${i}`) === 0.1), 'ejemplo 2: las de 1$ cargan 0.10');
  ok([0, 1, 2, 3].every((i) => por.get(`c${i}`) === 0.05), 'ejemplo 2: las de 0.5$ cargan 0.05');
  ok(suma(m) === 100, 'ejemplo 2: la suma da el monto del pago');
}

// ---- la suma SIEMPRE cierra, aunque los centavos no partan bien ----
{
  // 100 entre tres: 33.33 + 33.33 + 33.34
  const tres = repartirProporcional([p('a', 1), p('b', 1), p('c', 1)], 100);
  ok(suma(tres) === 10000, 'centavos: 100 entre tres cierra exacto');
  ok(tres.filter((x) => x.monto === 33.34).length === 1, 'centavos: el centavo que sobra cae en una sola');

  // Un monto que no se puede partir: 0.01 entre diez
  const migaja = repartirProporcional(
    Array.from({ length: 10 }, (_, i) => p(`r${i}`, 1)), 0.01,
  );
  ok(suma(migaja) === 1, 'centavos: un centavo entre diez sigue siendo un centavo');
  ok(migaja.length === 1, 'centavos: las que se quedan en cero no viajan como lineas');

  // Pesos irregulares, monto feo
  const feo = repartirProporcional(
    [p('a', 1663.2), p('b', 2520), p('c', 6566), p('d', 1218)], 1837.77,
  );
  ok(suma(feo) === 183777, 'centavos: con pesos irregulares tambien cierra');
  ok(feo.every((x) => x.monto > 0), 'centavos: ninguna linea sale en cero');
}

// ---- las que no tienen costo escrito no reciben nada ----
{
  const r = repartirProporcional([p('a', 100), p('b', null), p('c', 0)], 50);
  ok(r.length === 1 && r[0].rowUid === 'a', 'sin costo: solo carga la que tiene presupuesto');
  ok(r[0].monto === 50, 'sin costo: la unica con costo carga el pago entero');

  ok(repartirProporcional([p('a', null), p('b', null)], 50).length === 0,
    'sin costo: si ninguna tiene costo, no se reparte nada');
  ok(repartirProporcional([], 50).length === 0, 'sin costo: sin partidas no hay reparto');
  ok(repartirProporcional([p('a', 100)], 0).length === 0, 'monto cero: no hay nada que repartir');
}

// ---- una partida en cero nunca queda fuera ----
{
  // Con una sola en cero, el grupo entero pasa a partes iguales.
  const conCero = repartirEntre([p('a', 100), p('b', null), p('c', 300)], 90);
  ok(conCero.enPartesIguales === true, 'nunca fuera: avisa que cambio a partes iguales');
  ok(conCero.lineas.length === 3, 'nunca fuera: entran las tres', conCero.lineas.length);
  ok(conCero.lineas.every((x) => x.monto === 30), 'nunca fuera: 30 a cada una');
  ok(suma(conCero.lineas) === 9000, 'nunca fuera: la suma cierra');

  // Todas en cero: tambien reparte, no se queda sin hacer nada.
  const todasCero = repartirEntre([p('a', null), p('b', 0)], 10);
  ok(todasCero.lineas.length === 2 && todasCero.enPartesIguales,
    'nunca fuera: todas en cero se reparte igual', todasCero.lineas);

  // Con todas costeadas, manda la proporcion.
  const todasConCosto = repartirEntre([p('a', 300), p('b', 100)], 100);
  ok(todasConCosto.enPartesIguales === false, 'nunca fuera: si todas tienen costo, no se cambia nada');
  const porUid = new Map(todasConCosto.lineas.map((x) => [x.rowUid, x.monto]));
  ok(porUid.get('a') === 75 && porUid.get('b') === 25, 'nunca fuera: y reparte en proporcion', todasConCosto.lineas);
}

// ---- repartir dos veces lo mismo da lo mismo ----
{
  const partidas = [p('a', 3), p('b', 3), p('c', 3), p('d', 1)];
  const uno = JSON.stringify(repartirProporcional(partidas, 77.77));
  const dos = JSON.stringify(repartirProporcional(partidas, 77.77));
  ok(uno === dos, 'estable: el mismo reparto da el mismo resultado');
}

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
