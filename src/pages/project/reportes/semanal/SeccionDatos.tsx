/**
 * Los números de la semana: lo que sale solo de los reportes diarios y de las
 * solicitudes pagadas.
 *
 * Aquí no se edita nada, a propósito. Si un número no cuadra, lo que hay que
 * corregir es el reporte diario de ese día, y eso lo dice la propia sección.
 * Cada bloque va plegado —en un teléfono, cinco tablas abiertas serían un muro—
 * salvo el primero, que es el que se mira siempre.
 */

import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import {
  comoNumero, diaCorto, dinero, type DatosSemana,
} from './tipos';

function Plegable({
  titulo, resumen, abierto: inicial = false, children,
}: {
  titulo: string;
  resumen: string;
  abierto?: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(inicial);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        <ChevronRight
          className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${abierto ? 'rotate-90' : ''}`}
        />
        <span className="font-medium">{titulo}</span>
        <span className="ml-auto text-right text-sm tabular-nums text-muted-foreground">
          {resumen}
        </span>
      </button>
      {abierto && <div className="overflow-x-auto pb-4 md:pl-7">{children}</div>}
    </div>
  );
}

/** Celda de número por día: un día sin reporte diario se ve como una raya. */
function Celda({ valor, sufijo = '' }: { valor: number | null; sufijo?: string }) {
  return (
    <td className="px-2 py-1.5 text-right tabular-nums">
      {valor === null
        ? <span className="text-slate-300">—</span>
        : valor === 0
          ? <span className="text-slate-300">0</span>
          : `${valor}${sufijo}`}
    </td>
  );
}

export default function SeccionDatos({ datos }: { datos: DatosSemana }) {
  const dias = datos.dias;
  // El domingo solo ocupa columna si alguien reportó ese día: se asume libre.
  const visibles = dias.filter((d, i) => i < 6 || d.numero !== null);
  const indices = visibles.map((d) => dias.findIndex((x) => x.fecha === d.fecha));

  const cabecera = (
    <tr className="border-b border-slate-200">
      <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" />
      {visibles.map((d) => (
        <th
          key={d.fecha}
          className="w-16 px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {diaCorto(d.fecha)}
        </th>
      ))}
    </tr>
  );

  const horas = datos.horas_perdidas;
  const pagos = datos.pagos;

  return (
    <div>
      <p className="pb-1 text-sm text-muted-foreground">
        Salen solos de los reportes diarios y de las solicitudes pagadas. Si algo no cuadra,
        corrige el reporte diario de ese día.
      </p>

      <Plegable
        titulo="Equipo de trabajo"
        abierto
        resumen={[
          datos.personal_promedio === null
            ? 'sin reportes diarios'
            : `${datos.personal_promedio} por día en promedio`,
          horas.total > 0 ? `${horas.total} h perdidas` : null,
        ].filter(Boolean).join(' · ')}
      >
        <table className="w-full min-w-[32rem] text-sm">
          <thead>{cabecera}</thead>
          <tbody>
            {datos.personal.map((grupo) => (
              <Fragment key={grupo.empresa ?? 'propio'}>
                {datos.personal.length > 1 && (
                  <tr>
                    <td
                      colSpan={visibles.length + 1}
                      className="px-2 pt-3 text-xs font-semibold uppercase tracking-wide text-navy"
                    >
                      {grupo.empresa ?? 'Propio'}
                    </td>
                  </tr>
                )}
                {grupo.filas.map((f) => (
                  <tr key={`${grupo.empresa}-${f.nombre}`} className="border-b border-slate-100">
                    <td className="px-2 py-1.5">{f.nombre}</td>
                    {indices.map((i) => <Celda key={i} valor={f.por_dia[i]} />)}
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="border-t border-slate-200 font-semibold">
              <td className="px-2 py-1.5">Total en obra</td>
              {indices.map((i) => <Celda key={i} valor={datos.personal_total[i]} />)}
            </tr>
            <tr>
              <td className="px-2 py-1.5">Horas perdidas</td>
              {indices.map((i) => (
                <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                  {horas.por_dia[i] === null
                    ? <span className="text-slate-300">—</span>
                    : horas.por_dia[i] === 0
                      ? <span className="text-slate-300">0</span>
                      : <span className="font-semibold text-warning">{horas.por_dia[i]} h</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {horas.motivos.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {horas.motivos.map((m) => (
              <li key={m.fecha} className="flex gap-3">
                <span className="w-16 flex-none text-muted-foreground">{diaCorto(m.fecha)}</span>
                <span className="w-10 flex-none text-right font-semibold tabular-nums text-warning">
                  {m.horas} h
                </span>
                <span>{m.motivo ?? 'Sin motivo anotado'}</span>
              </li>
            ))}
          </ul>
        )}
      </Plegable>

      <Plegable
        titulo="Equipo"
        resumen={
          datos.equipos.length === 0
            ? 'sin equipo esta semana'
            : `${datos.equipos.length} ${datos.equipos.length === 1 ? 'máquina' : 'máquinas'} · ${
              datos.equipos.reduce((a, b) => a + b.total, 0)} h`
        }
      >
        {datos.equipos.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Ningún reporte diario de la semana anotó equipo.
          </p>
        ) : (
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Horas por día
                </th>
                {visibles.map((d) => (
                  <th key={d.fecha} className="w-16 px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {diaCorto(d.fecha)}
                  </th>
                ))}
                <th className="w-16 px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Semana
                </th>
              </tr>
            </thead>
            <tbody>
              {datos.equipos.map((e) => (
                <tr key={e.nombre} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5">{e.nombre}</td>
                  {indices.map((i) => <Celda key={i} valor={e.por_dia[i]} />)}
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{e.total} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Plegable>

      <Plegable
        titulo="Materiales que llegaron"
        resumen={
          datos.materiales.length === 0
            ? 'sin entregas'
            : `${datos.materiales.length} ${datos.materiales.length === 1 ? 'entrega' : 'entregas'}`
        }
      >
        {datos.materiales.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Ningún reporte diario de la semana anotó entregas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {datos.materiales.map((m, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="w-16 px-2 py-1.5 align-top text-muted-foreground">
                    {diaCorto(m.fecha)}
                  </td>
                  <td className="px-2 py-1.5">
                    {m.descripcion}{' '}
                    <span className="text-xs text-muted-foreground">{m.categoria.toLowerCase()}</span>
                    {m.notas && (
                      <span className="block text-xs text-muted-foreground">{m.notas}</span>
                    )}
                  </td>
                  <td className="w-24 px-2 py-1.5 text-right align-top tabular-nums">
                    {[m.cantidad, m.unidad].filter((x) => x !== null && x !== '').join(' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Plegable>

      <Plegable
        titulo="Pagos registrados en el sistema"
        resumen={
          pagos.solicitudes === 0
            ? 'sin pagos registrados'
            : `${pagos.solicitudes} ${pagos.solicitudes === 1 ? 'solicitud' : 'solicitudes'} · ${dinero(pagos.monto)}`
        }
      >
        {pagos.filas.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Ninguna solicitud del proyecto quedó pagada en esta semana.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {pagos.filas.map((p, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">{p.categoria ?? 'Sin categoría'}</td>
                  <td className="w-24 px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {p.solicitudes}
                  </td>
                  <td className="w-32 px-2 py-1.5 text-right tabular-nums">{dinero(p.monto)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-2 py-1.5">Total de la semana</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{pagos.solicitudes}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{dinero(pagos.monto)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Plegable>

      <Plegable
        titulo="Comparación con la semana anterior"
        resumen={(() => {
          const f = datos.comparacion.filas[0];
          const actual = comoNumero(f?.actual);
          const antes = comoNumero(f?.anterior);
          if (actual === null) return 'sin datos';
          return antes === null
            ? `${actual} por día · sin semana anterior`
            : `${actual} por día · antes ${antes}`;
        })()}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th />
              <th className="w-32 px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Semana anterior
              </th>
              <th className="w-28 px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Esta semana
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.comparacion.filas.map((f, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5">{f.etiqueta}</td>
                <td className="w-32 px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {f.anterior === null ? '—' : `${f.anterior}${f.unidad && ` ${f.unidad}`}`}
                </td>
                <td className="w-28 px-2 py-1.5 text-right tabular-nums">
                  {f.actual === null ? '—' : `${f.actual}${f.unidad && ` ${f.unidad}`}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Plegable>
    </div>
  );
}
