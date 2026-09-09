// repartoPartidas — repartir un gasto general entre varias partidas.
//
// Un extintor no es de ninguna partida, pero es plata de la obra. En vez de
// dejarlo colgando, se reparte: cada partida carga la parte que le toca SEGUN
// LO QUE TENGA PRESUPUESTADO. Si una partida es el 20% del presupuesto del
// grupo que se reparte, carga el 20% del extintor.
//
// Las partidas sin costo escrito no reciben nada: sin presupuesto no hay con
// que calcular su parte, y darles un pedazo igual seria inventarselo.
//
// Los centavos se reparten por el metodo del resto mayor: cada partida se lleva
// su parte entera y los centavos que sobran van a las que quedaron con la
// fraccion mas alta. Asi la suma da EXACTAMENTE el monto del pago, que es lo
// que el servidor exige para guardar.

export interface PartidaConPeso {
  rowUid: string;
  presupuestado: number | null;
}

export interface LineaReparto {
  rowUid: string;
  monto: number;
}

/** Reparte `monto` entre todas las partidas dadas, sin dejar ninguna fuera.
 *
 *  UNA PARTIDA EN CERO NUNCA SE DESCARTA. Que no tenga costo escrito no
 *  significa que ahi no pueda ir gasto: significa que todavia no se costeo, y
 *  el gasto que reciba la dejara pasada, que es justo lo que hay que ver.
 *
 *  Lo unico que el cero no sabe decir es que proporcion le toca, porque esa
 *  proporcion se calcula sobre esa misma cifra. Asi que si en el grupo hay
 *  aunque sea una en cero, el reparto entero va en PARTES IGUALES. */
export function repartirEntre(
  partidas: PartidaConPeso[],
  monto: number,
): { lineas: LineaReparto[]; enPartesIguales: boolean } {
  const algunaEnCero = partidas.some((p) => p.presupuestado == null || p.presupuestado <= 0);
  if (algunaEnCero) {
    const iguales = partidas.map((p) => ({ rowUid: p.rowUid, presupuestado: 1 }));
    return { lineas: repartirProporcional(iguales, monto), enPartesIguales: true };
  }
  return { lineas: repartirProporcional(partidas, monto), enPartesIguales: false };
}

/** La aritmetica sola: reparte en proporcion al peso de cada partida.
 *  Devuelve [] si ninguna tiene peso. Quien decide que peso usar es
 *  `repartirEntre`. */
export function repartirProporcional(
  partidas: PartidaConPeso[],
  monto: number,
): LineaReparto[] {
  const conPeso = partidas.filter(
    (p): p is PartidaConPeso & { presupuestado: number } =>
      p.presupuestado != null && p.presupuestado > 0,
  );
  const pesoTotal = conPeso.reduce((s, p) => s + p.presupuestado, 0);
  const centavosTotal = Math.round(monto * 100);
  if (conPeso.length === 0 || pesoTotal <= 0 || centavosTotal <= 0) return [];

  const crudos = conPeso.map((p, i) => {
    const exacto = (centavosTotal * p.presupuestado) / pesoTotal;
    const entero = Math.floor(exacto);
    return { i, rowUid: p.rowUid, entero, resto: exacto - entero };
  });

  let repartidos = crudos.reduce((s, c) => s + c.entero, 0);
  // Los centavos que sobran, a los restos mas altos. A igual resto manda el
  // orden del desglose, para que repartir dos veces lo mismo de lo mismo.
  const porResto = [...crudos].sort((a, b) => (b.resto - a.resto) || (a.i - b.i));
  for (let k = 0; repartidos < centavosTotal; k++, repartidos++) {
    porResto[k % porResto.length].entero++;
  }

  return crudos
    .filter((c) => c.entero > 0)
    .map((c) => ({ rowUid: c.rowUid, monto: c.entero / 100 }));
}
