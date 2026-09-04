// src/lib/presupuestoModel.ts — modelo puro del editor de la Hoja de Presupuesto.
//
// El estado son filas planas en orden de documento con `depth` explicito
// (precedente: desgloseModel). Los totales y la forma de cable indexada por
// padre se derivan; nunca se guardan.
//
// La regla del calculo de un renglon, que es lo que distingue esta hoja del
// desglose: cada FILA del calculo es una cosa real (un trabajador, un material,
// un equipo) y TODAS las columnas multiplican. Una casilla vacia no multiplica.
// Las columnas las nombra el usuario, asi que cada renglon tiene las suyas.
//
// Con red en scripts/presupuesto.spec.ts (npx tsx scripts/presupuesto.spec.ts).

export type Seccion = 'items' | 'generales';
export type Clase = 'mano_obra' | 'material' | 'equipo';

export interface CalculoColumna {
  uid: string;
  nombre: string;
}

export interface CalculoLinea {
  uid: string;
  concepto: string;
  /** Solo en items: si la linea es mano de obra, material o equipo. */
  clase: Clase | null;
  /** valores[columna.uid]; ausente o null = casilla vacia = no multiplica. */
  valores: Record<string, number | null>;
}

export interface RenglonCalculo {
  columnas: CalculoColumna[];
  lineas: CalculoLinea[];
}

/** Fila del PUT (la posee ESTE archivo; presupuestoApi la reexporta). */
export interface PresupuestoRenglonInput {
  tempId: number;
  rowUid?: string;
  parentTempId: number | null;
  seccion: Seccion;
  tipo: 'grupo' | 'item';
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  usaCalculo: boolean;
  calculo: RenglonCalculo | null;
  orden: number;
}

export interface PresupuestoRow {
  tempId: number;
  rowUid?: string;
  depth: number;
  seccion: Seccion;
  tipo: 'grupo' | 'item';
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  /** Escrito a mano. Se ignora cuando usaCalculo es true. */
  precioUnitario: number | null;
  usaCalculo: boolean;
  calculo: RenglonCalculo | null;
}

export const newUid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ---------------------------------------------------------------------------
// El calculo de un renglon
// ---------------------------------------------------------------------------

/** Calculo en blanco: una columna sin nombre y una linea vacia, para que la
 *  tabla nazca con algo donde escribir. */
export const emptyCalculo = (): RenglonCalculo => {
  const col: CalculoColumna = { uid: newUid(), nombre: '' };
  return { columnas: [col], lineas: [{ uid: newUid(), concepto: '', clase: null, valores: {} }] };
};

/** Total de una linea: el producto de TODAS las casillas con valor. Una linea
 *  sin ninguna casilla llena vale 0 — el producto vacio seria 1, y una fila en
 *  blanco no puede sumar un peso a la hoja. */
export function lineaTotal(calculo: RenglonCalculo, linea: CalculoLinea): number {
  let producto = 1;
  let hayValor = false;
  for (const col of calculo.columnas) {
    const v = linea.valores[col.uid];
    if (v == null || !Number.isFinite(v)) continue;
    producto *= v;
    hayValor = true;
  }
  return hayValor ? producto : 0;
}

/** Costo del renglon segun su calculo: la suma de sus lineas. */
export const calculoTotal = (calculo: RenglonCalculo | null): number =>
  calculo ? calculo.lineas.reduce((s, l) => s + lineaTotal(calculo, l), 0) : 0;

/** Subtotal de las lineas de una clase (mano de obra, material, equipo). */
export const calculoTotalPorClase = (calculo: RenglonCalculo | null, clase: Clase): number =>
  calculo
    ? calculo.lineas.filter((l) => l.clase === clase).reduce((s, l) => s + lineaTotal(calculo, l), 0)
    : 0;

// ---------------------------------------------------------------------------
// Totales de la hoja
// ---------------------------------------------------------------------------

/** True cuando rows[i] es un grupo que manda sobre al menos un hijo (la fila
 *  siguiente es mas profunda). Un grupo SIN hijos se comporta como un renglon
 *  normal y lleva su propio monto. */
export const hasChildren = (rows: PresupuestoRow[], i: number): boolean =>
  i + 1 < rows.length && rows[i + 1].depth > rows[i].depth;

/** Costo propio de un renglon, SIN el factor de la hoja:
 *  - un grupo con hijos no vale nada por si mismo (su total sube desde abajo);
 *  - con calculo, vale lo que sume su tabla;
 *  - sin calculo, vale cantidad x precio unitario.
 *
 *  Un renglon con precio pero SIN cantidad vale el precio: asi un costo suelto
 *  —polizas, seguros— se escribe con un solo numero, sin obligar a poner un 1
 *  en la cantidad. */
export function rowCosto(rows: PresupuestoRow[], i: number): number {
  const r = rows[i];
  if (r.tipo === 'grupo' && hasChildren(rows, i)) return 0;
  if (r.usaCalculo) return calculoTotal(r.calculo);
  if (r.precioUnitario == null) return 0;
  return r.cantidad != null ? r.cantidad * r.precioUnitario : r.precioUnitario;
}

/** Precio unitario que se MUESTRA para un item: el escrito a mano, o el que
 *  sale de repartir el costo calculado entre la cantidad. null cuando no se
 *  puede repartir (sin cantidad o cantidad cero). */
export function precioUnitarioMostrado(rows: PresupuestoRow[], i: number): number | null {
  const r = rows[i];
  if (!r.usaCalculo) return r.precioUnitario;
  if (r.cantidad == null || r.cantidad === 0) return null;
  return calculoTotal(r.calculo) / r.cantidad;
}

export const GRAND_TOTAL_KEY = -1;
export const ITEMS_TOTAL_KEY = -2;
export const GENERALES_TOTAL_KEY = -3;

/** Totales por tempId, SIN el factor de la hoja. Los grupos acumulan su rama.
 *  Las tres claves negativas traen el subtotal de items, el de Costos Generales
 *  y la suma de los dos. El factor se aplica al mostrar: multiplicar cada
 *  renglon o multiplicar la suma da lo mismo, y asi hay un solo lugar donde
 *  vive el redondeo. */
export function computeTotals(rows: PresupuestoRow[]): Map<number, number> {
  const totals = new Map<number, number>();
  let items = 0;
  let generales = 0;
  // Pila de ancestros por profundidad. Los renglones sueltos nunca ocupan
  // ranura, asi que la pila puede tener huecos: se saltan.
  const stack: (number | undefined)[] = [];
  rows.forEach((r, i) => {
    stack.length = r.depth;
    const t = rowCosto(rows, i);
    if (t) {
      if (r.seccion === 'items') items += t;
      else generales += t;
      for (const anc of stack) if (anc != null) totals.set(anc, (totals.get(anc) ?? 0) + t);
      totals.set(r.tempId, (totals.get(r.tempId) ?? 0) + t);
    } else if (!totals.has(r.tempId)) {
      totals.set(r.tempId, 0);
    }
    if (r.tipo === 'grupo') stack[r.depth] = r.tempId;
  });
  totals.set(ITEMS_TOTAL_KEY, items);
  totals.set(GENERALES_TOTAL_KEY, generales);
  totals.set(GRAND_TOTAL_KEY, items + generales);
  return totals;
}

export interface ResumenHoja {
  /** Suma de todos los renglones, sin factor. */
  costo: number;
  /** costo x factor: lo que suman los renglones tal como se muestran. */
  subtotal: number;
  itbms: number;
  total: number;
}

/** El pie de la hoja. El ITBMS va al final, sobre el subtotal ya multiplicado
 *  por el factor. */
export function resumenHoja(
  rows: PresupuestoRow[],
  factor: number,
  itbmsTasa: number | null,
): ResumenHoja {
  const costo = computeTotals(rows).get(GRAND_TOTAL_KEY) ?? 0;
  const subtotal = costo * factor;
  const itbms = itbmsTasa != null ? subtotal * (itbmsTasa / 100) : 0;
  return { costo, subtotal, itbms, total: subtotal + itbms };
}

// ---------------------------------------------------------------------------
// Cable
// ---------------------------------------------------------------------------

/** Orden de documento -> filas indexadas por padre (los padres siempre antes). */
export function toWireRenglones(rows: PresupuestoRow[]): PresupuestoRenglonInput[] {
  const stack: (number | undefined)[] = [];
  return rows.map((r, i) => {
    stack.length = r.depth;
    // Los renglones sueltos no escriben ranura, asi que depth-1 puede ser un
    // hueco: el padre real es la ranura de grupo definida mas cercana por
    // debajo de r.depth. Solo las filas de verdad raiz mandan null.
    let parentTempId: number | null = null;
    for (let d = r.depth - 1; d >= 0; d--) {
      const anc = stack[d];
      if (anc != null) { parentTempId = anc; break; }
    }
    if (r.tipo === 'grupo') stack[r.depth] = r.tempId;
    return {
      tempId: r.tempId,
      rowUid: r.rowUid,
      parentTempId,
      seccion: r.seccion,
      tipo: r.tipo,
      codigo: r.codigo,
      descripcion: r.descripcion,
      unidad: r.unidad,
      cantidad: r.cantidad,
      precioUnitario: r.precioUnitario,
      usaCalculo: r.usaCalculo,
      calculo: r.usaCalculo ? r.calculo : null,
      orden: i,
    };
  });
}

// ---------------------------------------------------------------------------
// Operaciones de estructura
// ---------------------------------------------------------------------------

/** Fin exclusivo de la rama que cuelga de rows[i]. */
export function subtreeEnd(rows: PresupuestoRow[], i: number): number {
  const depth = rows[i].depth;
  let j = i + 1;
  while (j < rows.length && rows[j].depth > depth) j++;
  return j;
}

/** Sangrar es legal cuando el resultado no salta mas de un nivel Y el vecino de
 *  arriba pertenece a la MISMA seccion: items y Costos Generales son dos
 *  bloques distintos de la hoja y no se pueden anidar uno dentro del otro. */
export const indentLegal = (rows: PresupuestoRow[], i: number): boolean =>
  i > 0 && rows[i].depth <= rows[i - 1].depth && rows[i - 1].seccion === rows[i].seccion;

export const outdentLegal = (rows: PresupuestoRow[], i: number): boolean => rows[i].depth > 0;

const shiftDepth = (rows: PresupuestoRow[], i: number, j: number, delta: number): PresupuestoRow[] =>
  rows.map((r, idx) => (idx >= i && idx < j ? { ...r, depth: r.depth + delta } : r));

/** Indice del renglon que quedaria de padre tras sangrar — su hermano anterior
 *  al mismo nivel — o -1 si sangrar no es legal. */
export function indentParentIndex(rows: PresupuestoRow[], i: number): number {
  if (!indentLegal(rows, i)) return -1;
  const depth = rows[i].depth;
  let k = i - 1;
  while (k >= 0 && rows[k].depth > depth) k--;
  return k >= 0 && rows[k].depth === depth ? k : -1;
}

/** +1 de profundidad para rows[i] y toda su rama. Devuelve la MISMA referencia
 *  cuando es ilegal o cuando el nuevo padre no es un grupo: promover a grupo es
 *  del componente, que pregunta antes porque se pierden datos. */
export function indentRows(rows: PresupuestoRow[], i: number): PresupuestoRow[] {
  const k = indentParentIndex(rows, i);
  if (k < 0 || rows[k].tipo !== 'grupo') return rows;
  return shiftDepth(rows, i, subtreeEnd(rows, i), 1);
}

/** -1 de profundidad. Devuelve la MISMA referencia cuando es ilegal: en el
 *  nivel 0, o cuando la fila movida es un renglon suelto y existe un hermano
 *  siguiente que quedaria colgando de algo que no es grupo. */
export function outdentRows(rows: PresupuestoRow[], i: number): PresupuestoRow[] {
  if (!outdentLegal(rows, i)) return rows;
  const j = subtreeEnd(rows, i);
  if (rows[i].tipo === 'item' && j < rows.length && rows[j].depth === rows[i].depth) return rows;
  return shiftDepth(rows, i, j, -1);
}

/** Quita rows[i] y toda su rama. */
export function deleteSubtree(rows: PresupuestoRow[], i: number): PresupuestoRow[] {
  return [...rows.slice(0, i), ...rows.slice(subtreeEnd(rows, i))];
}

export const nextTempId = (rows: PresupuestoRow[]): number =>
  rows.reduce((m, r) => Math.max(m, r.tempId), 0) + 1;

export function blankRow(
  tempId: number,
  seccion: Seccion,
  tipo: 'grupo' | 'item',
  depth: number,
): PresupuestoRow {
  return {
    tempId, rowUid: newUid(), depth, seccion, tipo,
    codigo: '', descripcion: '', unidad: null, cantidad: null,
    precioUnitario: null, usaCalculo: false, calculo: null,
  };
}

/** Inserta un renglon en blanco justo despues de rows[i]. Detras de un grupo
 *  entra como su PRIMER HIJO; detras de un renglon suelto entra como hermano.
 *  La seccion se hereda del ancla: nunca se cruza de bloque por accidente. */
export function insertRowAfter(
  rows: PresupuestoRow[],
  i: number,
  tipo: 'grupo' | 'item',
): PresupuestoRow[] {
  if (i < 0 || i >= rows.length) return rows;
  const anchor = rows[i];
  const depth = anchor.tipo === 'grupo' ? anchor.depth + 1 : anchor.depth;
  const fresh = blankRow(nextTempId(rows), anchor.seccion, tipo, depth);
  return [...rows.slice(0, i + 1), fresh, ...rows.slice(i + 1)];
}

/** Agrega un renglon al final de una seccion (el boton "+ agregar" del pie). */
export function appendRow(
  rows: PresupuestoRow[],
  seccion: Seccion,
  tipo: 'grupo' | 'item',
): PresupuestoRow[] {
  const fresh = blankRow(nextTempId(rows), seccion, tipo, 0);
  let end = rows.length;
  if (seccion === 'items') {
    end = rows.findIndex((r) => r.seccion === 'generales');
    if (end < 0) end = rows.length;
  }
  return [...rows.slice(0, end), fresh, ...rows.slice(end)];
}

/** Misma legalidad que moveSubtree — existe una rama hermana en esa direccion,
 *  dentro de la misma seccion — sin construir un arreglo nuevo. */
export function canMoveSubtree(rows: PresupuestoRow[], i: number, dir: -1 | 1): boolean {
  const { depth, seccion } = rows[i];
  if (dir === -1) {
    let k = i - 1;
    while (k >= 0 && rows[k].depth > depth) k--;
    return k >= 0 && rows[k].depth === depth && rows[k].seccion === seccion;
  }
  const j = subtreeEnd(rows, i);
  return j < rows.length && rows[j].depth === depth && rows[j].seccion === seccion;
}

/** Intercambia la rama de rows[i] con la rama hermana vecina. Las profundidades
 *  no cambian. Devuelve la MISMA referencia cuando no hay tal hermana. */
export function moveSubtree(rows: PresupuestoRow[], i: number, dir: -1 | 1): PresupuestoRow[] {
  if (!canMoveSubtree(rows, i, dir)) return rows;
  const j = subtreeEnd(rows, i);
  if (dir === -1) {
    const depth = rows[i].depth;
    let k = i - 1;
    while (k >= 0 && rows[k].depth > depth) k--;
    return [...rows.slice(0, k), ...rows.slice(i, j), ...rows.slice(k, i), ...rows.slice(j)];
  }
  const m = subtreeEnd(rows, j);
  return [...rows.slice(0, i), ...rows.slice(j, m), ...rows.slice(i, j), ...rows.slice(m)];
}