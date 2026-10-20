import { el } from '../dom.js';
import { renderAutoridad } from './autoridad.js';
import { renderConciliacion } from './conciliacion.js';
import { renderDesvio } from './desvio.js';
import { renderPanel } from './panel.js';
import { renderSimulador } from './simulador.js';

const SECCIONES = [
  ['panel', 'Panel de control', 'KPIs y bitácora', renderPanel],
  ['desvio', 'Desvío de proceso', 'retroactivas y línea de tiempo', renderDesvio],
  ['conciliacion', 'Conciliación', 'solicitud · cotización · factura', renderConciliacion],
  ['simulador', 'Simulador', 'qué pasaría si…', renderSimulador],
  ['autoridad', 'Autoridad', 'topes y quién aprueba', renderAutoridad],
];

/** Segunda pestana: cinco herramientas de analisis de solo lectura. Cada seccion se carga al abrirse. */
export function iniciarAnalisis() {
  const nav = document.getElementById('analisis-nav');
  const contenido = document.getElementById('analisis-contenido');
  let activa = null;

  async function abrir(id) {
    activa = id;
    for (const b of nav.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.id === id));
    contenido.replaceChildren(el('p', 'nota', 'Cargando…'));
    const [, , , render] = SECCIONES.find(([s]) => s === id);
    const destino = el('div', 'seccion');
    try {
      await render(destino);
      if (activa === id) contenido.replaceChildren(destino);
    } catch (e) {
      contenido.replaceChildren(el('p', 'nota aviso', `No se pudo cargar esta sección: ${e.message}`));
    }
  }

  for (const [id, titulo, detalle] of SECCIONES) {
    const b = el('button', 'sub-tab');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.id = id;
    b.append(el('strong', undefined, titulo), el('small', undefined, detalle));
    b.addEventListener('click', () => abrir(id));
    nav.append(b);
  }
  return { abrir: () => abrir(activa ?? 'panel'), recargar: () => activa && abrir(activa) };
}
