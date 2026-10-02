import { useEffect, useRef, useState, type DragEvent } from 'react';

interface Opciones {
  /** Los tipos que se aceptan, los mismos del input de archivo. Vacío = todos. */
  tipos?: string[];
  /** Apagado mientras se sube algo, o donde no se puede adjuntar. */
  activo?: boolean;
  alSoltar: (aceptados: File[], rechazados: File[]) => void;
}

/**
 * Arrastrar archivos desde la computadora y soltarlos en un recuadro, además
 * del botón de siempre (Ivan, 2026-10-02).
 *
 *   const { encima, props } = useSoltarArchivos({ tipos, alSoltar });
 *   <div {...props}>…</div>   // `encima` para pintar la zona mientras se arrastra
 *
 * Mientras haya una zona en pantalla, soltar un archivo FUERA de ella no hace
 * nada. Sin eso el navegador abre el archivo en la misma pestaña y la persona
 * se sale del sistema perdiendo lo que estaba escribiendo.
 */
export function useSoltarArchivos({ tipos = [], activo = true, alSoltar }: Opciones) {
  const [encima, setEncima] = useState(false);
  // dragenter y dragleave saltan también al pasar por cada hijo de la zona: se
  // cuentan para saber cuándo se salió de verdad.
  const dentro = useRef(0);

  useEffect(() => {
    if (!activo) return;
    const evitar = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', evitar);
    window.addEventListener('drop', evitar);
    return () => {
      window.removeEventListener('dragover', evitar);
      window.removeEventListener('drop', evitar);
    };
  }, [activo]);

  const conArchivos = (e: DragEvent) => e.dataTransfer.types.includes('Files');

  const props = activo
    ? {
        onDragEnter: (e: DragEvent) => {
          if (!conArchivos(e)) return;
          e.preventDefault();
          dentro.current += 1;
          setEncima(true);
        },
        onDragOver: (e: DragEvent) => {
          if (!conArchivos(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: (e: DragEvent) => {
          if (!conArchivos(e)) return;
          dentro.current = Math.max(0, dentro.current - 1);
          if (dentro.current === 0) setEncima(false);
        },
        onDrop: (e: DragEvent) => {
          if (!conArchivos(e)) return;
          e.preventDefault();
          dentro.current = 0;
          setEncima(false);
          const todos = Array.from(e.dataTransfer.files);
          const sirve = (f: File) => tipos.length === 0 || tipos.includes(f.type);
          alSoltar(todos.filter(sirve), todos.filter((f) => !sirve(f)));
        },
      }
    : {};

  return { encima: activo && encima, props };
}
