/**
 * Abrir un adjunto de una orden de compra en una pestaña nueva.
 *
 * La pestaña se abre ANTES de pedir el enlace: abierta después de esperar la
 * respuesta, el navegador la bloquea como ventana emergente. Y el enlace se pide
 * en el momento, no se guarda, porque R2 lo hace caducar a los 15 minutos.
 *
 * Devuelve false si no se pudo abrir, para que quien llama lo diga.
 */
import api from '@/services/api';

export async function abrirAdjunto(ordenId: number, adjuntoId: number): Promise<boolean> {
  const pestana = window.open('', '_blank');
  try {
    const r = await api.get(`/ordenes-compra/${ordenId}/adjuntos/urls`);
    const url = (r.data.adjuntos as { id: number; url: string }[]).find(
      (a) => a.id === adjuntoId,
    )?.url;
    if (url && pestana) {
      pestana.location.href = url;
      return true;
    }
    pestana?.close();
    return false;
  } catch {
    pestana?.close();
    return false;
  }
}
