// PresupuestoHojaCero — la hoja de un presupuesto armado desde cero.
//
// NO es una tabla propia: es el MISMO editor del desglose (DesgloseView),
// apuntado a los renglones del presupuesto. Las dos hojas tienen exactamente
// las mismas seis columnas y el mismo trabajo —escribir un árbol de renglones
// con sus montos—; lo único que cambia es que aquí la columna del valor
// unitario es el COSTO y no el precio. Tener dos tablas parecidas fue lo que
// hizo que se vieran distintas, así que hay una sola.
//
// Lo que este archivo aporta es la traducción en los dos sentidos: el
// presupuesto visto como un desglose al cargar, y las filas del editor vueltas
// renglones de presupuesto al guardar.

import { DesgloseView } from '@/components/desglose/DesgloseView';
import { DesgloseConflictError, type DesgloseDoc } from '@/lib/desgloseApi';
import type { DesgloseItemInput } from '@/lib/desgloseModel';
import {
  getPresupuesto, guardarHoja, PresupuestoConflictError,
  type PresupuestoDoc, type PresupuestoRenglonInput,
} from '@/lib/presupuestoApi';

/** El presupuesto visto como un desglose. `itbmsTasa` va en null: el ITBMS es
 *  del cuadro de precios del contrato y una hoja de costos no lo lleva. */
const comoDesglose = (d: PresupuestoDoc): DesgloseDoc => ({
  desglose: {
    id: d.presupuesto.id,
    proyectoId: d.presupuesto.proyectoId,
    nombre: d.presupuesto.nombre,
    tipo: 'presupuesto',
    itbmsTasa: null,
    updatedAt: d.presupuesto.updatedAt,
  },
  items: d.renglones.map((r) => ({
    id: r.id,
    rowUid: r.rowUid,
    parentId: r.parentId,
    tipo: r.tipo,
    item: r.codigo,
    descripcion: r.descripcion,
    unidad: r.unidad,
    cantidad: r.cantidad,
    // El COSTO ocupa el lugar del precio: es la columna que se escribe aquí.
    precioUnitario: r.costoUnitario,
    orden: r.orden,
  })),
});

/** Y de vuelta, al guardar. */
const comoRenglon = (it: DesgloseItemInput): PresupuestoRenglonInput => ({
  tempId: it.tempId,
  rowUid: it.rowUid,
  parentTempId: it.parentTempId,
  tipo: it.tipo,
  codigo: it.item,
  descripcion: it.descripcion,
  unidad: it.unidad,
  cantidad: it.cantidad,
  costoUnitario: it.precioUnitario,
});

interface Props {
  projectId: number;
  presupuestoId: number;
  /** El nombre del presupuesto, que es el encabezado de la sección. */
  nombre: string;
  /** Volver a la lista de presupuestos. */
  onBack: () => void;
}

export default function PresupuestoHojaCero({
  projectId, presupuestoId, nombre, onBack,
}: Props) {
  return (
    <DesgloseView
      proyectoId={projectId}
      titulo={nombre}
      onBack={onBack}
      etiquetaValorUnitario="Costo unit."
      mostrarItbms={false}
      mostrarHerramientas={false}
      cargarDoc={async () => comoDesglose(await getPresupuesto(projectId, presupuestoId))}
      guardarDoc={async (baseUpdatedAt, items) => {
        try {
          return comoDesglose(await guardarHoja(
            projectId, presupuestoId, baseUpdatedAt ?? '', items.map(comoRenglon),
          ));
        } catch (e) {
          // El editor sabe distinguir un choque de guardados del resto, pero
          // por su propio error: se traduce para que ofrezca «Recargar».
          if (e instanceof PresupuestoConflictError) throw new DesgloseConflictError(e.message);
          throw e;
        }
      }}
    />
  );
}
