// CurvaGasto — el gasto acumulado contra el presupuesto.
//
// Sigue el dibujo que Ivan aprobo. Lo que dice cada cosa:
//   · la curva azul es lo gastado, de la primera fecha de pago hasta hoy;
//   · el presupuesto es una RAYA RECTA, un techo: mientras no exista un costo
//     estimado repartido mes a mes no hay curva de presupuesto que dibujar, y
//     fingirla seria inventar datos. Cuando exista, esa recta se curva y la
//     pantalla no se mueve de sitio;
//   · la punteada del mismo gris es el "ritmo parejo", como iria el gasto si se
//     repartiera igual entre el inicio y el fin de la obra;
//   · el area clara entre la curva y el techo es lo que queda por gastar;
//   · lo que esta a la derecha de "hoy" va en gris, para que el vacio se lea
//     como "todavia no" y no como un fallo.
//
// Se dibuja a mano en SVG: el proyecto no tiene libreria de graficas y meter
// una por un solo cuadro no se justifica. La aritmetica vive en lib/curvaGasto
// para poder probarla.

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@/utils/formatters';
import { formatDate } from '@/utils/dateUtils';
import { acumular, dominioCurva, hoyISO, marcasDeMes, toDay } from '@/lib/curvaGasto';

// Margenes en pixeles de verdad. El dibujo se mide contra el hueco que le da la
// tarjeta y se dibuja a esa escala: nada de estirar un viewBox fijo, que era lo
// que aplastaba las letras.
const IZQ = 62;   // a la izquierda van las cifras del eje, incluida la del techo
const DER = 16;
const ARR = 12;   // aire por arriba, para que la raya del techo no se pegue
const ABA = 28;   // abajo van los meses

/** Cifras del eje, cortas: 250k en vez de 250,000. */
const corto = (v: number): string => {
  if (v >= 1_000_000) return `${Number((v / 1_000_000).toFixed(1))}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(Math.round(v));
};

/** Sin simbolo de moneda: dentro del dibujo el signo estorba. */
const miles = (v: number): string =>
  Math.round(v).toLocaleString('es-PA', { maximumFractionDigits: 0 });

interface Props {
  serie: { fecha: string; monto: number }[];
  /** Costo total del presupuesto oficial; null = el proyecto no tiene. */
  presupuesto: number | null;
  inicio: string | null;
  fin: string | null;
}

export default function CurvaGasto({ serie, presupuesto, inicio, fin }: Props) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const [tam, setTam] = useState({ w: 640, h: 320 });

  // El tamano real del hueco. Sin esto habria que estirar un viewBox fijo, y
  // estirarlo aplasta las letras y engorda unas rayas mas que otras.
  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setTam({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(caja);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const { w: W, h: H } = tam;
    const X0 = IZQ;
    const X1 = W - DER;
    const Y0 = ARR;
    const Y1 = H - ABA;
    const IW = Math.max(1, X1 - X0);
    const IH = Math.max(1, Y1 - Y0);

    const puntos = acumular(serie);
    const hoy = toDay(hoyISO());
    const dom = dominioCurva(puntos, presupuesto, inicio, fin, hoy);

    // El eje llega hasta el escalon redondo que queda POR ENCIMA del techo, asi
    // que siempre hay una marca arriba de la raya del presupuesto.
    const tope = Math.max(dom.yMax, dom.gastado, 1);
    const x = (dia: number) => X0 + ((dia - dom.d0) / dom.span) * IW;
    const y = (v: number) => Y1 - (v / tope) * IH;

    // La reticula lleva TODOS los escalones: saltarse uno deja la escala coja y
    // se nota. Lo unico que se calla es la CIFRA que quede pegada a la del
    // presupuesto, porque ahi si se leerian como una sola.
    const yTecho = presupuesto != null && presupuesto > 0 ? y(presupuesto) : null;
    const marcasY = dom.pasos.filter((v) => v > 0);
    const cifrasY = marcasY.filter((v) => yTecho == null || Math.abs(y(v) - yTecho) > 9);

    // Una linea, no escalones: se une punto con punto. Los escalones eran
    // fieles al dia exacto del pago, pero se leen como una escalera y lo que se
    // quiere ver aqui es la tendencia.
    const vertices: [number, number][] = [[x(dom.d0), y(0)]];
    for (const p of puntos) vertices.push([x(p.dia), y(p.acumulado)]);
    const xHoy = x(Math.max(hoy, puntos.length ? puntos[puntos.length - 1].dia : hoy));
    vertices.push([xHoy, y(dom.gastado)]);

    const linea = vertices.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
    const area = `${linea} L${xHoy},${y(0)} L${x(dom.d0)},${y(0)} Z`;

    // Lo que queda por gastar: el hueco entre la curva y el techo, hasta hoy.
    const queda = yTecho != null && presupuesto! > dom.gastado
      ? `M${x(dom.d0)},${yTecho} L${xHoy},${yTecho} `
        + [...vertices].reverse().map(([px, py]) => `L${px},${py}`).join(' ')
        + ' Z'
      : null;

    // El fin de obra y, si ya pasó, cuántos días lleva encima.
    const diaFin = fin ? toDay(fin) : null;
    const diasPasados = diaFin != null && hoy > diaFin ? hoy - diaFin : 0;

    return {
      ...dom, puntos, x, y, tope, marcasY, cifrasY, linea, area, queda, yTecho, xHoy,
      meses: marcasDeMes(dom.d0, dom.d1),
      W, H, X0, X1, Y0, Y1, IW, diaFin, diasPasados,
    };
  }, [serie, presupuesto, inicio, fin, tam]);

  const alMover = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!g.puntos.length || !svgRef.current) return;
    const caja = svgRef.current.getBoundingClientRect();
    const dia = g.d0 + ((e.clientX - caja.left) - g.X0) / g.IW * g.span;
    let mejor = 0;
    g.puntos.forEach((p, i) => {
      if (Math.abs(p.dia - dia) < Math.abs(g.puntos[mejor].dia - dia)) mejor = i;
    });
    setFoco(mejor);
  };

  const p = foco != null ? g.puntos[foco] : null;
  const hayTecho = g.yTecho != null;

  // Llena a su padre, que TIENE que estar posicionado y con alto propio: el
  // SVG va absoluto para poder estirarse, y sobre una caja de alto cero se
  // dibujaria en nada. El alto lo pone la tarjeta que lo contiene.
  return (
    <div ref={cajaRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${g.W} ${g.H}`}
        
        className="absolute inset-0 block h-full w-full"
        role="img"
        aria-label="Gasto acumulado del proyecto contra el presupuesto"
        onMouseMove={alMover}
        onMouseLeave={() => setFoco(null)}
      >
        <defs>
          {/* El color sale de la variable del tema, no de un hex: asi el
              relleno sigue al modo oscuro igual que el resto. */}
          <linearGradient id="curva-gasto-relleno" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopOpacity="0.26" className="[stop-color:var(--color-navy)]" />
            <stop offset="100%" stopOpacity="0.02" className="[stop-color:var(--color-navy)]" />
          </linearGradient>
        </defs>

        {/* Lo que todavía no ha pasado, en gris: que el vacío se lea como
            "todavía no" y no como un fallo. */}
        {g.hoy < g.d1 && (
          <rect
            x={g.x(g.hoy)} y={g.Y0} width={Math.max(0, g.x(g.d1) - g.x(g.hoy))} height={g.Y1 - g.Y0}
            className="fill-muted-foreground/[0.05]"
          />
        )}

        {/* Lo que va DESPUÉS del fin de obra: la obra ya se pasó de plazo y esa
            franja es el atraso, así que se pinta aparte y en color de aviso. */}
        {g.diasPasados > 0 && g.diaFin != null && (
          <rect
            x={g.x(g.diaFin)} y={g.Y0} width={Math.max(0, g.x(g.hoy) - g.x(g.diaFin))} height={g.Y1 - g.Y0}
            className="fill-warning/[0.07]"
          />
        )}

        {/* Retícula, solo horizontal y muy clara: está para poder leer una
            altura a ojo, no para verse. */}
        {g.marcasY.map((v) => (
          <line key={v} x1={g.X0} x2={g.X1} y1={g.y(v)} y2={g.y(v)} className="stroke-slate-100" strokeWidth={1} />
        ))}
        {/* La del cero, un punto más marcada: el dibujo se apoya en ella. */}
        <line x1={g.X0} x2={g.X1} y1={g.Y1} y2={g.Y1} className="stroke-border" strokeWidth={1.5} />

        <g className="fill-muted-foreground text-[10px] tabular-nums" textAnchor="end">
          <text x={g.X0 - 8} y={g.Y1 + 3}>0</text>
          {g.cifrasY.map((v) => (
            <text key={v} x={g.X0 - 8} y={g.y(v) + 3}>{corto(v)}</text>
          ))}
        </g>

        <g className="fill-muted-foreground text-[10px]" textAnchor="middle">
          {g.meses.map((m) => (
            <text key={m.dia} x={g.x(m.dia)} y={g.H - 8}>{m.texto}</text>
          ))}
        </g>

        {/* Lo que queda por gastar. La cifra va colgada del techo, no en el
            centro del area: centrada cae encima de la curva cuando el gasto
            todavia es poco. */}
        {g.queda && (
          <>
            <path d={g.queda} className="fill-muted-foreground/[0.07]" />
            <text
              x={(g.X0 + g.xHoy) / 2}
              y={g.yTecho! + 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[10.5px] tabular-nums"
            >
              Queda {miles(presupuesto! - g.gastado)}
            </text>
          </>
        )}

        {/* Ritmo parejo: del cero al presupuesto, repartido por igual. Va MUY
            tenue a propósito — es una vara de referencia, no un dato — y así no
            se confunde con la raya del presupuesto. */}
        {hayTecho && fin && (
          <line
            x1={g.X0} y1={g.Y1} x2={g.x(toDay(fin))} y2={g.yTecho!}
            className="stroke-slate-300/70" strokeWidth={1}
            strokeDasharray="1 5" strokeLinecap="round"
          />
        )}

        {/* El presupuesto: fino y con guion corto, que esté sin gritar. Su
            cifra va en el eje de la izquierda, con las demás, en vez de un
            recuadro flotando dentro del dibujo. */}
        {hayTecho && (
          <>
            <line x1={g.X0} y1={g.yTecho!} x2={g.X1} y2={g.yTecho!}
              className="stroke-slate-400" strokeWidth={1.5} strokeDasharray="3 3" />
            <text
              x={g.X0 - 8} y={g.yTecho! + 3} textAnchor="end"
              className="fill-foreground text-[10px] font-semibold tabular-nums"
            >
              {miles(presupuesto!)}
            </text>
          </>
        )}

        {/* El fin de obra, marcado claro: es la fecha contra la que se juzga
            todo lo demás. Va entera, no punteada, para que no se confunda con
            las rayas de plan. */}
        {g.diaFin != null && (
          <>
            <line x1={g.x(g.diaFin)} x2={g.x(g.diaFin)} y1={g.Y0} y2={g.Y1}
              className={g.diasPasados > 0 ? 'stroke-warning' : 'stroke-slate-400'}
              strokeWidth={1.5} />
            <text
              x={g.x(g.diaFin) - 6} y={g.Y0 + 10} textAnchor="end"
              className={g.diasPasados > 0
                ? 'fill-warning text-[10px] font-semibold'
                : 'fill-muted-foreground text-[10px]'}
            >
              Fin {formatDate(fin!)}
            </text>
            {g.diasPasados > 0 && (
              <text
                x={g.x(g.diaFin) + 6} y={g.Y0 + 10}
                className="fill-warning text-[10px] font-semibold"
              >
                {g.diasPasados === 1 ? '1 día pasado' : `${g.diasPasados} días pasados`}
              </text>
            )}
          </>
        )}

        {/* Hoy. */}
        <line x1={g.x(g.hoy)} x2={g.x(g.hoy)} y1={g.Y0} y2={g.Y1}
          className="stroke-slate-400" strokeWidth={1} strokeDasharray="2 3" />

        {/* Lo gastado. */}
        {g.puntos.length > 0 && (
          <>
            <path d={g.area} fill="url(#curva-gasto-relleno)" />
            <path d={g.linea} fill="none" className="stroke-navy" strokeWidth={2.25}
              strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={g.xHoy} cy={g.y(g.gastado)} r={4.5}
              className="fill-navy stroke-card" strokeWidth={2} />
          </>
        )}

        {/* El punto que se está mirando: su vertical y el punto marcado sobre
            la curva, para que la cifra de al lado tenga a qué agarrarse. */}
        {p && (
          <>
            <line x1={g.x(p.dia)} x2={g.x(p.dia)} y1={g.Y0} y2={g.Y1}
              className="stroke-navy/40" strokeWidth={1} />
            <circle cx={g.x(p.dia)} cy={g.y(p.acumulado)} r={4}
              className="fill-navy stroke-card" strokeWidth={2} />
          </>
        )}
      </svg>

      {/* La cifra va A LA ALTURA de la curva, no arriba del cuadro, y deja ver
          la línea por detrás: es el acumulado de ese día, nada más. */}
      {p && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[150%] whitespace-nowrap rounded-md border border-border/70 bg-card/70 px-2 py-1 text-xs shadow-sm backdrop-blur-[2px]"
          style={{ left: `${g.x(p.dia)}px`, top: `${g.y(p.acumulado)}px` }}
        >
          <span className="font-semibold tabular-nums">{formatMoney(p.acumulado)}</span>
          <span className="ml-1.5 text-muted-foreground">{formatDate(p.fecha)}</span>
        </div>
      )}
    </div>
  );
}
