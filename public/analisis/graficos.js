import { el } from '../dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, atributos = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, String(v));
  return e;
};

export const numero = (n) => (typeof n === 'number' ? n.toLocaleString('es-CO') : '—');
export const pct = (n) => (typeof n === 'number' ? `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %` : '—');

/** Barra proporcional de una sola fila. Los anchos van por CSSOM (compatible con la CSP sin 'unsafe-inline'). */
export function barra(valor, maximo, clase = 'info') {
  const pista = el('div', 'pista');
  const relleno = el('div', `relleno ${clase}`);
  relleno.style.width = `${maximo ? Math.min(100, (valor / maximo) * 100) : 0}%`;
  pista.append(relleno);
  return pista;
}

/** Barra apilada con leyenda: segmentos = [{ etiqueta, valor, clase }]. */
export function barraApilada(segmentos) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  const caja = el('div', 'apilada');
  const fila = el('div', 'apilada-barra');
  fila.setAttribute('role', 'img');
  fila.setAttribute('aria-label', segmentos.map((s) => `${s.etiqueta}: ${s.valor}`).join(', '));
  for (const s of segmentos.filter((x) => x.valor > 0)) {
    const seg = el('div', `segmento ${s.clase}`, String(s.valor));
    seg.style.flexGrow = String(s.valor);
    seg.title = `${s.etiqueta}: ${s.valor}`;
    fila.append(seg);
  }
  const leyenda = el('ul', 'leyenda');
  for (const s of segmentos) {
    const li = el('li');
    li.append(el('i', `punto ${s.clase}`), `${s.etiqueta} · ${s.valor}${total ? ` (${Math.round((s.valor / total) * 100)} %)` : ''}`);
    leyenda.append(li);
  }
  caja.append(fila, leyenda);
  return caja;
}

/** Lista de barras horizontales: filas = [{ etiqueta, valor, detalle, clase }]. */
export function listaBarras(filas, maximo) {
  const ul = el('ul', 'lista-barras');
  const tope = maximo ?? Math.max(1, ...filas.map((f) => f.valor));
  for (const f of filas) {
    const li = el('li');
    const cab = el('div', 'lb-cab');
    cab.append(el('span', 'lb-etiqueta', f.etiqueta), el('span', 'lb-valor', f.detalle ?? String(f.valor)));
    li.append(cab, barra(f.valor, tope, f.clase ?? 'info'));
    ul.append(li);
  }
  return ul;
}

export function semaforo(estado, texto) {
  const clase = { ok: 'bueno', alerta: 'malo', sin_dato: 'neutro' }[estado] ?? 'neutro';
  return el('span', `sello ${clase}`, texto);
}

const COLORES = { cotizacion: 'cotizacion', solicitud: 'solicitud', aprobacion: 'aprobacion', factura: 'factura', oc: 'oc' };
const NOMBRES = { cotizacion: 'Cotización', solicitud: 'Solicitud', aprobacion: 'Aprobación', factura: 'Factura', oc: 'OC' };

/**
 * Linea de tiempo de un caso: puntos SVG ubicados proporcionalmente a su fecha y, debajo, una leyenda en chips
 * (evita que se encimen las etiquetas cuando varios documentos ocurren en dias seguidos).
 * La OC no entra en la escala: su fecha es la de la ejecucion, no parte del proceso de compra.
 */
export function lineaTiempo(eventos) {
  const ancho = 640, alto = 34, margen = 24;
  const enEscala = eventos.filter((e) => e.tipo !== 'oc');
  const fechas = enEscala.map((e) => Date.parse(`${e.fecha}T00:00:00Z`));
  const min = Math.min(...fechas), max = Math.max(...fechas);
  const x = (t) => (max === min ? ancho / 2 : margen + ((t - min) / (max - min)) * (ancho - margen * 2));
  const lienzo = svg('svg', { viewBox: `0 0 ${ancho} ${alto}`, class: 'timeline', role: 'img', 'aria-label': eventos.map((e) => `${NOMBRES[e.tipo]} ${e.fecha}`).join(', ') });
  lienzo.append(svg('line', { x1: margen, y1: 17, x2: ancho - margen, y2: 17, class: 'eje' }));
  enEscala.forEach((e, i) => lienzo.append(svg('circle', { cx: x(fechas[i]), cy: 17, r: 7, class: `punto-ev ${COLORES[e.tipo]}` })));

  const chips = el('ul', 'leyenda ev-leyenda');
  for (const e of eventos) {
    const li = el('li');
    li.append(el('i', `punto ${COLORES[e.tipo]}`), `${NOMBRES[e.tipo]} · ${e.fecha}${e.tipo === 'oc' ? ` · ${e.detalle}` : ''}`);
    chips.append(li);
  }
  const caja = el('div', 'timeline-bloque');
  caja.append(lienzo, chips);
  return caja;
}

/** Tabla simple: columnas = [{ titulo, celda(fila) -> string|Node }]. */
export function tabla(columnas, filas, vacio = 'Sin datos') {
  const caja = el('div', 'tabla');
  const t = el('table', 'mini');
  const cab = el('tr');
  for (const c of columnas) cab.append(el('th', undefined, c.titulo));
  t.append(cab);
  for (const f of filas) {
    const tr = el('tr');
    for (const c of columnas) {
      const td = el('td');
      const v = c.celda(f);
      td.append(v instanceof Node ? v : document.createTextNode(String(v ?? '—')));
      tr.append(td);
    }
    t.append(tr);
  }
  if (!filas.length) { const tr = el('tr'); const td = el('td', 'vacio', vacio); td.colSpan = columnas.length; tr.append(td); t.append(tr); }
  caja.append(t);
  return caja;
}

export function tarjeta(titulo, subtitulo, ...contenido) {
  const t = el('section', 'tarjeta panel-tarjeta');
  const cab = el('header', 'tarjeta-cab');
  cab.append(el('h4', undefined, titulo));
  if (subtitulo) cab.append(el('span', 'subtitulo', subtitulo));
  t.append(cab);
  const cuerpo = el('div', 'tarjeta-contenido');
  cuerpo.append(...contenido);
  t.append(cuerpo);
  return t;
}

export function kpi(valor, etiqueta, clase = '') {
  const k = el('div', `kpi grande ${clase}`);
  k.append(el('strong', undefined, valor), el('span', undefined, etiqueta));
  return k;
}
