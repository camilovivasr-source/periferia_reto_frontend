import { nombrePaso, tarjetaPara } from './cards.js';
import { el } from './dom.js';
import { renderMarkdown } from './markdown.js';

const mensajes = () => document.getElementById('mensajes');
export const bajar = () => { const m = mensajes(); m.scrollTop = m.scrollHeight; };
export const mostrarBienvenida = (visible) => { document.getElementById('bienvenida').hidden = !visible; };

export function limpiarChat() {
  for (const n of [...mensajes().children]) if (n.id !== 'bienvenida') n.remove();
  mostrarBienvenida(true);
}

export function agregarUsuario(texto) {
  mostrarBienvenida(false);
  mensajes().append(el('div', 'msg usuario', texto));
  bajar();
}

function filaLlamada(l, enCurso) {
  const detalle = el('details', 'llamada');
  detalle.dataset.id = l.id;
  const resumen = el('summary');
  resumen.append(el('span', 'nombre', `${enCurso ? '⏳' : l.ok ? '✓' : '✗'} ${l.nombre}`), el('span', 'res', enCurso ? 'ejecutando…' : l.resumen));
  if (!enCurso) resumen.append(el('span', 'ms', `${l.ms} ms`));
  const cuerpo = enCurso ? { argumentos: l.args } : { argumentos: l.args, resultado: l.resultado };
  detalle.append(resumen, el('pre', undefined, JSON.stringify(cuerpo, null, 2)));
  return detalle;
}

function chipPaso(l, estado) {
  const chip = el('span', `paso-chip ${estado}`, `${estado === 'curso' ? '…' : estado === 'ok' ? '✓' : '✗'} ${nombrePaso(l.nombre)}`);
  chip.dataset.id = l.id;
  return chip;
}

const reemplazarOAgregar = (contenedor, nodo, id) => {
  const previo = contenedor.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (previo) previo.replaceWith(nodo); else contenedor.append(nodo);
};

/** Mensaje del agente: pasos de herramientas (colapsables), tarjetas estructuradas y texto. */
export class MensajeAgente {
  constructor() {
    this.pasos = el('details', 'pasos');
    this.resumen = el('summary');
    this.lista = el('div', 'lista-pasos');
    this.pasos.append(this.resumen, this.lista);
    this.pasos.hidden = true;
    this.tarjetas = el('div', 'tarjetas');
    this.cuerpo = el('div', 'cuerpo');
    this.caja = el('div', 'msg agente');
    this.caja.append(this.pasos, this.tarjetas, this.cuerpo);
    mostrarBienvenida(false);
    mensajes().append(this.caja);
  }

  pensando() {
    const p = el('span', 'pensando');
    p.append(document.createTextNode('Pensando'), el('i'), el('i'), el('i'));
    this.cuerpo.replaceChildren(p);
  }

  llamada(l, enCurso = false) {
    this.pasos.hidden = false;
    reemplazarOAgregar(this.lista, filaLlamada(l, enCurso), l.id);
    reemplazarOAgregar(this.resumen, chipPaso(l, enCurso ? 'curso' : l.ok ? 'ok' : 'fallo'), l.id);
    if (enCurso) return;
    const tarjeta = tarjetaPara(document, l);
    if (tarjeta) this.tarjetas.append(tarjeta);
  }

  texto(markdown) {
    this.cuerpo.replaceChildren(renderMarkdown(document, markdown));
    const n = this.lista.children.length;
    if (n) this.resumen.prepend(el('span', undefined, `${n} paso${n > 1 ? 's' : ''}`));
  }

  error(mensaje) {
    this.caja.classList.add('error');
    this.cuerpo.replaceChildren(document.createTextNode(`No pude completar el turno: ${mensaje}. La sesión sigue activa; puedes reintentar.`));
  }
}
