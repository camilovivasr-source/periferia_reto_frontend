import { renderMarkdown } from './markdown.js';

const $ = (id) => document.getElementById(id);
const mensajes = $('mensajes'), form = $('form'), texto = $('texto'), enviar = $('enviar'), confirmacion = $('confirmacion');

let sessionId = null;
try { sessionId = sessionStorage.getItem('sessionId'); } catch { /* almacenamiento bloqueado */ }
const nuevaSesion = () => {
  sessionId = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
  try { sessionStorage.setItem('sessionId', sessionId); } catch { /* ignorar */ }
};
const sesionPrevia = !!sessionId && sessionId.length >= 8;
if (!sesionPrevia) nuevaSesion();

const el = (tag, clase, contenido) => { const e = document.createElement(tag); if (clase) e.className = clase; if (contenido !== undefined) e.textContent = contenido; return e; };
const bajar = () => { mensajes.scrollTop = mensajes.scrollHeight; };

function burbujaUsuario(t) { const m = el('div', 'msg usuario', t); mensajes.append(m); bajar(); }

function tarjetaLlamada(l, enCurso = false) {
  const d = el('details', `llamada ${enCurso ? 'curso' : l.ok ? 'ok' : 'fallo'}`);
  d.dataset.id = l.id;
  const s = el('summary');
  s.append(el('span', 'nombre', `${enCurso ? '⏳' : l.ok ? '✓' : '✗'} ${l.nombre}`), el('span', 'res', enCurso ? 'ejecutando…' : l.resumen));
  if (!enCurso) s.append(el('span', 'ms', `${l.ms} ms`));
  d.append(s);
  const pre = el('pre');
  pre.textContent = JSON.stringify(enCurso ? { argumentos: l.args } : { argumentos: l.args, resultado: l.resultado }, null, 2);
  d.append(pre);
  return d;
}

function burbujaAgente() {
  const caja = el('div', 'msg agente');
  const llamadas = el('div', 'llamadas');
  const cuerpo = el('div', 'cuerpo');
  caja.append(llamadas, cuerpo);
  mensajes.append(caja);
  return { caja, llamadas, cuerpo };
}

function mostrarConfirmacion(pendientes) {
  confirmacion.replaceChildren();
  if (!pendientes?.length) { confirmacion.hidden = true; return; }
  confirmacion.hidden = false;
  for (const p of pendientes) {
    const bloque = el('div');
    bloque.append(el('strong', 'titulo', `Confirmación pendiente · ${p.caso}`));
    const ul = el('ul');
    for (const c of p.confirmaciones) { const li = el('li'); li.append(el('strong', undefined, `${c.codigo}: `), c.detalle); ul.append(li); }
    const acciones = el('div', 'acciones');
    const si = el('button', undefined, `Confirmo crear la OC de ${p.caso}`);
    const no = el('button', 'peligro', 'No, cancelar');
    si.type = no.type = 'button';
    si.addEventListener('click', () => mandar(`Confirmo: crea la OC de ${p.caso} con las excepciones indicadas.`));
    no.addEventListener('click', () => mandar(`No, cancela ${p.caso}.`));
    acciones.append(si, no);
    bloque.append(ul, acciones);
    confirmacion.append(bloque);
  }
}

function pintarTurno(burbuja, r) {
  burbuja.cuerpo.replaceChildren(renderMarkdown(document, r.reply));
  mostrarConfirmacion(r.pendientes);
}

async function mandar(mensaje) {
  const t = mensaje.trim();
  if (!t || enviar.disabled) return;
  burbujaUsuario(t);
  texto.value = '';
  enviar.disabled = true;
  confirmacion.hidden = true;
  const b = burbujaAgente();
  b.cuerpo.append(el('span', 'pensando', 'Pensando…'));
  bajar();
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ sessionId, message: t }) });
    if (!r.ok || !r.body) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.detalles?.join('; ') || e.error || `Error HTTP ${r.status}`);
    }
    const lector = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '', final = null;
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let corte;
      while ((corte = buf.indexOf('\n\n')) >= 0) {
        const bloque = buf.slice(0, corte); buf = buf.slice(corte + 2);
        const linea = bloque.split('\n').find((x) => x.startsWith('data: '));
        if (!linea) continue;
        const ev = JSON.parse(linea.slice(6));
        if (ev.tipo === 'tool_start') { b.llamadas.append(tarjetaLlamada({ id: ev.id, nombre: ev.nombre, args: ev.args }, true)); }
        else if (ev.tipo === 'tool_end') { const previa = b.llamadas.querySelector(`[data-id="${CSS.escape(ev.llamada.id)}"]`); const nueva = tarjetaLlamada(ev.llamada); previa ? previa.replaceWith(nueva) : b.llamadas.append(nueva); }
        else if (ev.tipo === 'complete') final = ev;
        else if (ev.tipo === 'error') throw new Error(ev.error);
        bajar();
      }
    }
    if (!final) throw new Error('La respuesta se cortó antes de terminar. Intenta de nuevo.');
    pintarTurno(b, final);
  } catch (e) {
    b.caja.classList.add('error');
    b.cuerpo.replaceChildren(document.createTextNode(`No pude completar el turno: ${e.message}. La sesión sigue activa; puedes reintentar.`));
  } finally {
    enviar.disabled = false;
    texto.focus();
    bajar();
  }
}

async function restaurar() {
  try {
    const r = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
    if (!r.ok) return;
    const { historial } = await r.json();
    for (const h of historial) {
      if (h.rol === 'user') burbujaUsuario(h.contenido);
      else {
        const b = burbujaAgente();
        for (const l of h.toolCalls ?? []) b.llamadas.append(tarjetaLlamada(l));
        b.cuerpo.replaceChildren(renderMarkdown(document, h.contenido));
      }
    }
    bajar();
  } catch { /* sin historial */ }
}

async function iniciar() {
  try {
    const salud = await (await fetch('/api/backend-health')).json();
    const chip = $('modo');
    chip.textContent = salud.modo === 'LLM' ? `${salud.modelo}` : 'modo práctica (sin LLM)';
    chip.className = `chip ${salud.modo === 'LLM' ? 'llm' : 'practica'}`;
  } catch { $('modo').textContent = 'backend sin respuesta'; }
  try {
    const { casos } = await (await fetch('/api/casos')).json();
    const ul = $('casos');
    for (const c of casos) {
      const li = el('li'); const b = el('button', undefined, c); b.type = 'button';
      b.addEventListener('click', () => { texto.value = `Procesa la solicitud "${c}". Muéstrame la OC como quedaría en SAP, qué validaciones pasó y cuáles no, y no la crees hasta que yo lo confirme.`; texto.focus(); });
      li.append(b); ul.append(li);
    }
  } catch { /* casos no disponibles */ }
  if (sesionPrevia) await restaurar();
}

form.addEventListener('submit', (e) => { e.preventDefault(); mandar(texto.value); });
texto.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandar(texto.value); } });
$('nueva').addEventListener('click', () => { nuevaSesion(); mensajes.replaceChildren(); confirmacion.hidden = true; });
iniciar();
