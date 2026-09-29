/**
 * Personal y Equipo de un reporte ya terminado, como tablas con una columna
 * por cuadrilla.
 *
 * Decisión de Ivan del 2026-09-28, escogida en un mock entre tres: las
 * cuadrillas van arriba con sus siglas y la clave debajo de la tabla, para que
 * los nombres largos no ensanchen las columnas. En Equipo cada cuadrilla lleva
 * dos columnas, U (unidades) y H (horas), separadas por una raya, para que
 * cada casilla sea un solo número. El PDF dice lo mismo (reportePdf.ts).
 *
 * Las columnas y sus siglas vienen hechas del servidor (siglasEmpresas.ts),
 * para que la pantalla y el papel digan las mismas. Un puesto o una máquina con
 * el mismo nombre en dos cuadrillas es una sola fila con un número en cada
 * columna.
 *
 * Con una sola cuadrilla —lo normal en una obra sin subcontratistas— no hay
 * siglas ni clave: la tabla es nombre y número.
 */

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ColumnaEmpresa, EquipoGuardado, PersonalGuardado } from './tipos';

/** Las filas de la tabla: un nombre, y lo de cada cuadrilla bajo ese nombre. */
function porNombre<F extends { nombre: string; empresa_id: number | null }>(filas: F[]) {
  const nombres: string[] = [];
  const celda = new Map<string, F>();
  for (const f of filas) {
    if (!nombres.includes(f.nombre)) nombres.push(f.nombre);
    celda.set(`${f.nombre}|${f.empresa_id ?? 'propio'}`, f);
  }
  return {
    nombres,
    de: (nombre: string, c: ColumnaEmpresa) => celda.get(`${nombre}|${c.empresa_id ?? 'propio'}`),
  };
}

/** Solo las cuadrillas que tienen filas en esta tabla. */
const conFilas = (columnas: ColumnaEmpresa[], filas: { empresa_id: number | null }[]) =>
  columnas.filter((c) => filas.some((f) => f.empresa_id === c.empresa_id));

const num = (v: number | string) => Number(v);

// Angostas en el teléfono: tres empresas en Equipo son seis columnas de número.
const TH = 'h-auto px-1.5 py-1.5 text-right text-xs font-semibold text-primary md:px-2';
const TD = 'px-1.5 py-1.5 text-right text-sm tabular-nums md:px-2 md:text-[15px]';
const NOMBRE = 'px-1.5 py-1.5 text-sm md:px-2 md:text-[15px]';
/** La raya que separa una cuadrilla de la otra en Equipo. */
const RAYA = 'border-l border-border';

function Numero({ valor, className }: { valor: number | undefined; className?: string }) {
  return (
    <TableCell className={cn(TD, !valor && 'text-muted-foreground/50', className)}>
      {valor ? valor : '–'}
    </TableCell>
  );
}

/** Qué quiere decir cada sigla. */
function Clave({ columnas, extra }: { columnas: ColumnaEmpresa[]; extra?: string }) {
  if (columnas.length < 2 && !extra) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {extra && <span>{extra}</span>}
      {columnas.length > 1 && columnas.map((c) => (
        <span key={c.empresa_id ?? 'propio'}>
          <b className="font-semibold text-primary">{c.sigla}</b> {c.nombre}
        </span>
      ))}
    </p>
  );
}

export function TablaPersonal({
  filas, columnas: todas,
}: {
  filas: PersonalGuardado[];
  columnas: ColumnaEmpresa[];
}) {
  const columnas = conFilas(todas, filas);
  const varias = columnas.length > 1;
  const { nombres, de } = porNombre(filas);
  const cantidad = (nombre: string, c: ColumnaEmpresa) => num(de(nombre, c)?.cantidad ?? 0);
  const totalFila = (nombre: string) => columnas.reduce((s, c) => s + cantidad(nombre, c), 0);
  const totalColumna = (c: ColumnaEmpresa) => nombres.reduce((s, n) => s + cantidad(n, c), 0);
  const total = nombres.reduce((s, n) => s + totalFila(n), 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(TH, 'text-left')} />
              {varias
                ? columnas.map((c) => (
                  <TableHead key={c.empresa_id ?? 'propio'} className={TH} title={c.nombre}>
                    {c.sigla}
                  </TableHead>
                ))
                : null}
              <TableHead className={cn(TH, varias && 'bg-muted')}>
                {varias ? 'Total' : 'Cantidad'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nombres.map((n) => (
              <TableRow key={n} className="hover:bg-transparent">
                <TableCell className={NOMBRE}>{n}</TableCell>
                {varias && columnas.map((c) => (
                  <Numero key={c.empresa_id ?? 'propio'} valor={cantidad(n, c)} />
                ))}
                <Numero valor={totalFila(n)} className={cn(varias && 'bg-muted')} />
              </TableRow>
            ))}
            <TableRow className="border-t border-border font-bold hover:bg-transparent">
              <TableCell className={cn(NOMBRE, 'md:text-sm')}>Total en obra</TableCell>
              {varias && columnas.map((c) => (
                <TableCell key={c.empresa_id ?? 'propio'} className={cn(TD, 'font-bold')}>
                  {totalColumna(c)}
                </TableCell>
              ))}
              <TableCell className={cn(TD, 'font-bold', varias && 'bg-muted')}>{total}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <Clave columnas={columnas} />
    </div>
  );
}

export function TablaEquipo({
  filas, columnas: todas,
}: {
  filas: EquipoGuardado[];
  columnas: ColumnaEmpresa[];
}) {
  const columnas = conFilas(todas, filas);
  const varias = columnas.length > 1;
  const { nombres, de } = porNombre(filas);

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {varias && (
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead className={TH} />
                {columnas.map((c) => (
                  <TableHead
                    key={c.empresa_id ?? 'propio'}
                    colSpan={2}
                    className={cn(TH, RAYA, 'text-center')}
                    title={c.nombre}
                  >
                    {c.sigla}
                  </TableHead>
                ))}
              </TableRow>
            )}
            <TableRow className="hover:bg-transparent">
              <TableHead className={TH} />
              {columnas.map((c) => [
                <TableHead key={`u${c.empresa_id}`} className={cn(TH, varias && RAYA, 'text-muted-foreground')}>U</TableHead>,
                <TableHead key={`h${c.empresa_id}`} className={cn(TH, 'text-muted-foreground')}>H</TableHead>,
              ])}
            </TableRow>
          </TableHeader>
          <TableBody>
            {nombres.map((n) => (
              <TableRow key={n} className="hover:bg-transparent">
                <TableCell className={NOMBRE}>{n}</TableCell>
                {columnas.map((c) => {
                  const f = de(n, c);
                  return [
                    <Numero
                      key={`u${c.empresa_id}`}
                      valor={f ? num(f.unidades) : undefined}
                      className={cn(varias && RAYA)}
                    />,
                    <Numero key={`h${c.empresa_id}`} valor={f ? num(f.horas) : undefined} />,
                  ];
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Clave columnas={columnas} extra="U unidades · H horas" />
    </div>
  );
}
