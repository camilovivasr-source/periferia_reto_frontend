/** Cliente del backend (a traves del proxy del frontend). */

const json = async (ruta) => (await fetch(ruta)).json();

export const consultarSalud = () => json('/api/backend-health');
export const consultarCasos = async () => (await json('/api/casos')).detalle;

export async function consultarHistorial(sessionId) {
  const r = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
  return r.ok ? (await r.json()).historial : [];
}

/**
 * Envia un mensaje y entrega los eventos del turno por SSE (tool_start, tool_end).
 * Devuelve el evento `complete` con la respuesta final; lanza Error con un mensaje legible si algo falla.
 */
export async function enviarTurno(sessionId, message, alEvento) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ sessionId, message }),
  });
  if (!r.ok || !r.body) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detalles?.join('; ') || e.error || `Error HTTP ${r.status}`);
  }
  const lector = r.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = '';
  let final = null;
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    buffer += decodificador.decode(value, { stream: true });
    let corte;
    while ((corte = buffer.indexOf('\n\n')) >= 0) {
      const bloque = buffer.slice(0, corte);
      buffer = buffer.slice(corte + 2);
      const linea = bloque.split('\n').find((x) => x.startsWith('data: '));
      if (!linea) continue;
      const evento = JSON.parse(linea.slice(6));
      if (evento.tipo === 'complete') final = evento;
      else if (evento.tipo === 'error') throw new Error(evento.error);
      else alEvento(evento);
    }
  }
  if (!final) throw new Error('La respuesta se cortó antes de terminar. Intenta de nuevo.');
  return final;
}

// ── Analisis (solo lectura; la simulacion ocurre en memoria del servidor) ──
export const consultarAnalisis = (nombre) => json(`/api/analisis/${nombre}`);
export const consultarDetalleCaso = (caso) => json(`/api/analisis/caso/${encodeURIComponent(caso)}`);
export const consultarAutoridad = (centro, monto) => json(`/api/analisis/autoridad?centro=${encodeURIComponent(centro)}&monto=${encodeURIComponent(monto)}`);

export async function simular(caso, cambios) {
  const r = await fetch('/api/analisis/simular', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caso, cambios }) });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.detalles?.join('; ') || cuerpo.error || `Error HTTP ${r.status}`);
  return cuerpo;
}

// ── Solicitudes nuevas ──
export const consultarOpciones = () => json('/api/opciones');

export async function registrarSolicitud(cuerpo) {
  const r = await fetch('/api/solicitudes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.detalles?.join('; ') || datos.error || `Error HTTP ${r.status}`);
  return datos;
}

export async function registrarCarpeta(carga) {
  const r = await fetch('/api/solicitudes/carpeta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(carga) });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.detalles?.join('; ') || datos.error || `Error HTTP ${r.status}`);
  return datos;
}
