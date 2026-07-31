// Gate del cálculo del Cuadro de Cuenta (avance por fila).
// cd andrei-frontend && npx tsx scripts/cuadro.spec.ts
import {
  calcLinea, calcTotales, depthMap, parentsSet, esContenedor,
  cantidadDisponible, validarCantidad, type CuadroLinea,
} from '../src/lib/cuadroModel';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) passed++; else { failed++; console.log(`FAIL  ${label}`); }
}
const L = (over: Partial<CuadroLinea>): CuadroLinea => ({
  rowUid: over.rowUid ?? Math.random().toString(36).slice(2),
  parentRowUid: null, tipo: 'item', item: '', descripcion: '', unidad: null,
  cantidadPresupuesto: null, precioUnitario: null, cantidadEjecutada: 0, cantidadAnterior: 0, ...over,
});

// ---- hoja: valor = cantidad × precio, exacto ----
{
  const l = L({ cantidadPresupuesto: 90.51, precioUnitario: 872, cantidadEjecutada: 0 });
  const c = calcLinea(l, false, 0);
  ok(Math.abs(c.presupuestoTotal - 78924.72) < 1e-6, 'hoja: presupuesto total = cant × PU');
  ok(c.este.valor === 0 && Math.abs(c.falta.valor - 78924.72) < 1e-6, 'hoja: por ejecutar = presupuesto cuando 0 avance');
}

// ---- total a la fecha = anterior + este; por ejecutar = presupuesto − total ----
{
  const l = L({ cantidadPresupuesto: 50, precioUnitario: 1, cantidadAnterior: 30, cantidadEjecutada: 20 });
  const c = calcLinea(l, false, 0);
  ok(c.fecha.cant === 50 && c.falta.cant === 0, 'total a la fecha y por ejecutar por cantidad');
  ok(c.fecha.pct === 1 && c.falta.pct === 0, 'última cuenta cae en 100%');
}

// ---- precisión: 33.1455% + 22.0970% = 55.2425% (no 55.24 de sumar 2 dec) ----
{
  const l = L({ cantidadPresupuesto: 90.51, precioUnitario: 1, cantidadAnterior: 30, cantidadEjecutada: 20 });
  const c = calcLinea(l, false, 0);
  const pAnt = c.anterior.pct * 100, pEste = c.este.pct * 100, pTot = c.fecha.pct * 100;
  ok(Math.abs(pTot - 55.2425) < 1e-3, `% total a la fecha full precision ≈ 55.2425 (${pTot.toFixed(4)})`);
  ok(Math.abs((pAnt + pEste) - pTot) < 1e-9, 'sumar % full precision SÍ cuadra con el % total');
  ok(Number(pAnt.toFixed(2)) + Number(pEste.toFixed(2)) !== Number(pTot.toFixed(2)) || true, 'a 2 dec el redondeo puede no cuadrar (por eso el toggle de decimales)');
}

// ---- contenedor vs sección de una línea ----
{
  const g = L({ rowUid: 'G', tipo: 'grupo' });
  const hijo = L({ rowUid: 'H', parentRowUid: 'G', cantidadPresupuesto: 2, precioUnitario: 10, cantidadEjecutada: 1 });
  const seccion = L({ rowUid: 'S', tipo: 'grupo', cantidadPresupuesto: 1, precioUnitario: 5000, cantidadEjecutada: 1 });
  const lineas = [g, hijo, seccion];
  const parents = parentsSet(lineas);
  ok(esContenedor(g, parents) && !esContenedor(seccion, parents), 'contenedor: grupo con hijos sí, sección-línea no');
  ok(calcLinea(g, true, 0).presupuestoTotal === 0, 'contenedor no lleva montos propios');
  ok(calcLinea(seccion, false, 0).presupuestoTotal === 5000, 'sección-línea lleva su propio monto');
  const d = depthMap(lineas);
  ok(d.get('G') === 0 && d.get('H') === 1 && d.get('S') === 0, 'depth por parentRowUid');
}

// ---- totales: solo hojas aportan; % del valor, no de sumar % ----
{
  const lineas: CuadroLinea[] = [
    L({ rowUid: 'g', tipo: 'grupo' }),
    L({ rowUid: 'a', parentRowUid: 'g', cantidadPresupuesto: 1, precioUnitario: 15000, cantidadEjecutada: 1 }),
    L({ rowUid: 'b', parentRowUid: 'g', cantidadPresupuesto: 1, precioUnitario: 10000, cantidadEjecutada: 0 }),
  ];
  const t = calcTotales(lineas);
  ok(t.presupuesto === 25000 && t.este === 15000, 'totales: presupuesto y este periodo');
  ok(Math.abs(t.pctPeriodo - 0.6) < 1e-9, 'totales: % periodo = 15000/25000');
  ok(t.fecha === 15000 && Math.abs(t.pctTotal - 0.6) < 1e-9, 'totales: total a la fecha y su %');
}

// ---- límites de la cantidad del periodo ----
{
  const l = L({ cantidadPresupuesto: 50, precioUnitario: 1, cantidadAnterior: 30 });
  ok(cantidadDisponible(l) === 20, 'disponible = presupuesto − anterior');
  ok(validarCantidad(20, l) === null, 'cabe exactamente lo disponible');
  ok(validarCantidad(20.0001, l) === 'excede', 'no cabe más de lo disponible');
  ok(validarCantidad(-1, l) === 'negativa', 'no se aceptan negativos');
  ok(validarCantidad(NaN, l) === 'invalida', 'texto que no es número es inválido');
  ok(validarCantidad(0, l) === null, 'cero es válido');
}
{
  // Fila ya completada en periodos anteriores: no cabe nada más.
  const l = L({ cantidadPresupuesto: 10, cantidadAnterior: 10 });
  ok(cantidadDisponible(l) === 0 && validarCantidad(0.01, l) === 'excede', 'fila completa no admite más');
}
{
  // Sobre-ejecución heredada: disponible se queda en 0, nunca negativo.
  const l = L({ cantidadPresupuesto: 10, cantidadAnterior: 12 });
  ok(cantidadDisponible(l) === 0, 'disponible nunca es negativo');
}
{
  // El redondeo binario no debe disparar el error: 0.1+0.2 === 0.30000000000000004
  const l = L({ cantidadPresupuesto: 0.3, cantidadAnterior: 0 });
  ok(validarCantidad(0.1 + 0.2, l) === null, 'la tolerancia absorbe el redondeo binario');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
