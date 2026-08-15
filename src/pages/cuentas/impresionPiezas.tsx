// src/pages/cuentas/impresionPiezas.tsx — piezas compartidas por las dos
// pantallas de la hoja imprimible del Cuadro de Cuenta: la de configuración
// (Configurar Cuenta, montaje del proyecto) y la vista previa de una cuenta.
//
// Viven aquí y no en components/shell porque son de este módulo: no las usa
// ninguna otra parte del sistema.

import { useRef, type ChangeEvent } from 'react';
import { ChevronDown, ChevronUp, ImageOff, Plus, Trash2, Upload, X } from 'lucide-react';
import logoPinellas from '@/assets/logo.png';
import logoCocp from '@/assets/LogoCOCPfondoblanco.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MAX_LOGOS_PER_SIDE } from '@/lib/cronogramaPrint';
import { MAX_LINEAS_FIRMA } from '@/lib/cuadroPrint';
import { MAX_FIRMAS, mover, type FirmaImpresion } from '@/lib/cuentaImpresion';
import type { LogoChoice } from '@/lib/cronogramaApi';

/** Un logo subido a mano no puede engordar la fila del proyecto: el JSONB
 *  completo tiene tope de 600 KB en el endpoint que lo guarda. */
const MAX_LOGO_BYTES = 400_000;

/** La imagen para la miniatura del panel. En pantalla basta la URL del bundle;
 *  el data URL solo hace falta al imprimir (ver printLogos.resolveLogo). */
const miniaturaDe = (c: LogoChoice): string | null => {
  if (c === 'pinellas') return logoPinellas;
  if (c === 'cocp') return logoCocp;
  return typeof c === 'object' && c ? c.dataUrl : null;
};

export type Guardado = 'limpio' | 'guardando' | 'error';

export function Titulo({ texto }: { texto: string }) {
  return (
    <span className="block text-[11px] font-bold uppercase tracking-[0.09em] text-teal">
      {texto}
    </span>
  );
}

/** Marca las líneas cuyo valor calcula el sistema desde el cuadro. */
export function ChipAuto() {
  return (
    <span className="shrink-0 rounded-full border border-teal/30 bg-teal/10 px-1.5 text-[10px] font-bold uppercase tracking-wide text-teal">
      auto
    </span>
  );
}

export function EstadoGuardado({ estado }: { estado: Guardado }) {
  const txt = estado === 'guardando'
    ? 'Guardando…'
    : estado === 'error' ? 'No se pudo guardar' : 'Guardado';
  return (
    <span className={cn('text-xs', estado === 'error' ? 'text-error' : 'text-muted-foreground')}>
      {txt}
    </span>
  );
}

/** Subir y bajar un renglón. Flechas y no arrastrar: son filas de 28 px en un
 *  panel angosto, donde agarrar y soltar falla más de lo que acierta. */
export function BotonesOrden({
  i, total, onMover,
}: {
  i: number;
  total: number;
  onMover: (desde: number, hasta: number) => void;
}) {
  const clases = 'flex h-3.5 w-4 items-center justify-center rounded-sm text-muted-foreground '
    + 'hover:text-foreground disabled:opacity-25 disabled:hover:text-muted-foreground '
    + 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        className={clases}
        disabled={i === 0}
        aria-label="Subir"
        onClick={() => onMover(i, i - 1)}
      >
        <ChevronUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        className={clases}
        disabled={i === total - 1}
        aria-label="Bajar"
        onClick={() => onMover(i, i + 1)}
      >
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}

/** El campo con su par de flechas pegado al borde izquierdo, separado por una
 *  línea vertical: las flechas se leen como parte del control, no como dos
 *  botones sueltos al lado. Dentro van campos SIN borde propio — los estilos
 *  de `campoPlano` / `autoPlano`. */
export function CampoOrdenable({
  i, total, onMover, children,
}: {
  i: number;
  total: number;
  onMover: (desde: number, hasta: number) => void;
  children: React.ReactNode;
}) {
  const flecha = 'flex h-3 items-center justify-center text-muted-foreground '
    + 'hover:text-foreground disabled:opacity-25 disabled:hover:text-muted-foreground '
    + 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
  return (
    <div className="flex h-7 min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-input bg-card focus-within:ring-1 focus-within:ring-ring">
      <div className="flex w-[18px] shrink-0 flex-col justify-center gap-0.5 border-r border-input bg-muted/50">
        <button
          type="button"
          className={flecha}
          disabled={i === 0}
          aria-label="Subir"
          onClick={() => onMover(i, i - 1)}
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          className={flecha}
          disabled={i === total - 1}
          aria-label="Bajar"
          onClick={() => onMover(i, i + 1)}
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

/** Campo sin borde propio, para ir dentro de `CampoOrdenable`. */
export const campoPlano = 'h-full rounded-none border-0 bg-transparent px-2 text-xs '
  + 'shadow-none focus-visible:ring-0';

/** Fila con el valor que ya calcula el sistema: se ve, no se escribe. */
export function FilaAuto({ texto, plano = false }: { texto: string; plano?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-teal/[0.06]',
        plano
          ? 'h-full min-w-0 flex-1 px-2'
          : 'rounded-md border border-teal/30 px-2.5 py-1',
      )}
    >
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {texto || '—'}
      </span>
      <ChipAuto />
    </div>
  );
}

/** Las firmas del pie de la hoja. Cada una es una lista de hasta
 *  MAX_LINEAS_FIRMA líneas: la primera es el nombre (sale en negrita) y debajo
 *  caben cargo, empresa, cédula…
 *
 *  `estructural` distingue poner o quitar algo de escribir dentro de un campo:
 *  la pantalla que lleva historial lo usa para que cada uno sea un paso propio
 *  al deshacer. */
export function EditorFirmas({
  firmas, onChange,
}: {
  firmas: FirmaImpresion[];
  onChange: (next: FirmaImpresion[], estructural: boolean) => void;
}) {
  const editarFirma = (i: number, fn: (f: FirmaImpresion) => FirmaImpresion, est = false) =>
    onChange(firmas.map((f, j) => (j === i ? fn(f) : f)), est);

  return (
    <>
      <Titulo texto={`Firmas (${firmas.length} de ${MAX_FIRMAS})`} />
      {firmas.map((f, i) => (
        <div key={i} className="space-y-1 rounded-md border border-border p-2">
          <div className="flex items-center gap-2">
            <BotonesOrden
              i={i}
              total={firmas.length}
              onMover={(d, h) => onChange(mover(firmas, d, h), true)}
            />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Firma {i + 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6 shrink-0 text-muted-foreground hover:text-error"
              aria-label="Quitar firma"
              onClick={() => onChange(firmas.filter((_, j) => j !== i), true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {f.lineas.map((t, li) => (
            <div key={li} className="flex items-center gap-1">
              <Input
                className="h-7 text-xs"
                placeholder={li === 0 ? 'Nombre' : `Línea ${li + 1}`}
                value={t}
                onChange={(e) => editarFirma(i, (x) => ({
                  lineas: x.lineas.map((y, k) => (k === li ? e.target.value : y)),
                }))}
              />
              {f.lineas.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  aria-label="Quitar línea de la firma"
                  onClick={() => editarFirma(i, (x) => ({
                    lineas: x.lineas.filter((_, k) => k !== li),
                  }), true)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {f.lineas.length < MAX_LINEAS_FIRMA && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-1 h-7 text-muted-foreground"
              onClick={() => editarFirma(i, (x) => ({ lineas: [...x.lineas, ''] }), true)}
            >
              <Plus className="h-3.5 w-3.5" /> Línea
            </Button>
          )}
        </div>
      ))}
      {firmas.length < MAX_FIRMAS && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 text-muted-foreground"
          onClick={() => onChange([...firmas, { lineas: [''] }], true)}
        >
          <Plus className="h-3.5 w-3.5" /> Firma
        </Button>
      )}
    </>
  );
}

/** Los logos de un lado de la hoja, puestos como azulejos: se ven en su tamaño
 *  y se eligen mirándolos, no leyendo sus nombres. Pueden ser los de la casa o
 *  una imagen subida, que viaja como data URL dentro del propio montaje.
 *
 *  El bloque NO lleva caja propia: dentro de una Card no van más Cards, los
 *  dos lados se separan con una línea (FRONTEND_CONVENTIONS §8). */
export function EditorLogos({
  label, valores, onChange, onAviso,
}: {
  label: string;
  valores: LogoChoice[];
  onChange: (next: LogoChoice[]) => void;
  onAviso: (msg: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pedirImagen = () => fileRef.current?.click();

  const subir = async (e: ChangeEvent<HTMLInputElement>) => {
    onAviso(null);
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      onAviso('El logo debe ser una imagen.');
      return;
    }
    const dataUrl = await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(f);
    });
    if (!dataUrl) {
      onAviso('No se pudo leer el logo.');
      return;
    }
    if (dataUrl.length > MAX_LOGO_BYTES) {
      onAviso('Logo demasiado grande (máx. ~400 KB). Usa una imagen más liviana.');
      return;
    }
    onChange([...valores, { dataUrl }]);
  };

  const lleno = valores.length >= MAX_LOGOS_PER_SIDE;

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {valores.map((c, i) => {
          const src = miniaturaDe(c);
          return (
            <div
              key={i}
              className="relative flex h-12 w-[84px] items-center justify-center rounded-md border border-border bg-card p-1.5"
            >
              {src
                ? <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                : <ImageOff className="h-4 w-4 text-muted-foreground" />}
              <Button
                variant="outline"
                size="icon"
                className="absolute -right-1.5 -top-1.5 h-[18px] w-[18px] rounded-full bg-card p-0 text-muted-foreground hover:text-error"
                aria-label={`Quitar logo ${i + 1} de ${label.toLowerCase()}`}
                onClick={() => onChange(valores.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
        {/* El recuadro punteado dice "aquí cabe otro" sin gastar un botón
            aparte, y el logo se elige VIENDOLO, no leyendo su nombre. */}
        {!lleno && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-12 w-[84px] flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-teal hover:text-teal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Plus className="h-3.5 w-3.5" />
                Logo
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Elegir logo
              </DropdownMenuLabel>
              {(['pinellas', 'cocp'] as const).map((nombre) => (
                <DropdownMenuItem
                  key={nombre}
                  className="gap-2.5"
                  onSelect={() => onChange([...valores, nombre])}
                >
                  <span className="flex h-[30px] w-[52px] shrink-0 items-center justify-center rounded border border-border p-0.5">
                    <img
                      src={miniaturaDe(nombre) ?? ''}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </span>
                  {nombre === 'pinellas' ? 'Pinellas' : 'COCP'}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5" onSelect={pedirImagen}>
                <span className="flex h-[30px] w-[52px] shrink-0 items-center justify-center rounded border border-border">
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                Subir otra imagen…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <Input ref={fileRef} type="file" accept="image/*" onChange={subir} className="hidden" />
    </div>
  );
}
