import { claseEstado, dinero, etiquetaEstado } from './cards.js';
import { el } from './dom.js';

const kpi = (n, texto) => {
  const k = el('div', 'kpi');
  k.append(el('strong', undefined, String(n)), el('span', undefined, texto));
  return k;
};

function tarjetaCaso(c, alPedir) {
  const creada = c.estado === 'CREADA';
  const boton = el('button', 'boton-enlace', creada ? 'Ver' : 'Procesar');
  boton.type = 'button';
  boton.setAttribute('aria-label', `${boton.textContent} ${c.caso}`);
  boton.addEventListener('click', () => alPedir(c));

  const cabecera = el('div', 'caso-cab');
  cabecera.append(el('span', 'caso-id', c.caso), el('span', `sello ${claseEstado(c.estado)}`, etiquetaEstado(c.estado)));
  const pie = el('div', 'caso-pie');
  pie.append(el('span', 'caso-valor', c.valor_total ? dinero(c.valor_total, c.moneda ?? 'COP') : (c.detalle ?? '—')), boton);
  const li = el('li', 'caso');
  li.append(cabecera, el('div', 'caso-prov', c.proveedor ?? ''), pie);
  return li;
}

/** Barra lateral: contadores y una tarjeta por solicitud con su estado segun los controles. */
export function pintarCasos(casos, alPedir) {
  const creadas = casos.filter((c) => c.estado === 'CREADA').length;
  const bloqueadas = casos.filter((c) => c.estado === 'BLOQUEADA' || c.estado === 'ERROR_DATOS').length;
  document.getElementById('resumen').replaceChildren(kpi(creadas, 'creadas'), kpi(casos.length - creadas - bloqueadas, 'por revisar'), kpi(bloqueadas, 'bloqueadas'));
  document.getElementById('casos').replaceChildren(...casos.map((c) => tarjetaCaso(c, alPedir)));
}
