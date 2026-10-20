import { el } from './dom.js';

/** Banner de confirmacion pendiente: resalta lo que el agente necesita y ofrece las dos respuestas posibles. */
export function pintarConfirmacion(pendientes, enviar) {
  const banner = document.getElementById('confirmacion');
  banner.replaceChildren();
  banner.hidden = !pendientes?.length;
  for (const p of pendientes ?? []) {
    const lista = el('ul');
    for (const c of p.confirmaciones) {
      const li = el('li');
      li.append(el('strong', undefined, `${c.codigo}: `), c.detalle);
      lista.append(li);
    }
    const si = el('button', 'boton', `Confirmo: crear la OC de ${p.caso}`);
    const no = el('button', 'boton peligro', 'No, cancelar');
    si.type = no.type = 'button';
    si.addEventListener('click', () => enviar(`Confirmo: crea la OC de ${p.caso} con las excepciones indicadas.`));
    no.addEventListener('click', () => enviar(`No, cancela ${p.caso}.`));
    const acciones = el('div', 'acciones');
    acciones.append(si, no);
    const bloque = el('div');
    bloque.append(el('strong', 'titulo', `Confirmación pendiente · ${p.caso}`), lista, acciones);
    banner.append(bloque);
  }
}

/** Respuestas rapidas calculadas por el servidor segun el estado; se ocultan mientras hay una confirmacion pendiente. */
export function pintarSugerencias(sugerencias, hayConfirmacion, enviar) {
  const caja = document.getElementById('sugerencias');
  caja.replaceChildren();
  if (hayConfirmacion) return;
  for (const texto of sugerencias ?? []) {
    const b = el('button', 'sugerencia', texto);
    b.type = 'button';
    b.addEventListener('click', () => enviar(texto));
    caja.append(b);
  }
}

export function ocultarAvisos() {
  document.getElementById('confirmacion').hidden = true;
  document.getElementById('sugerencias').replaceChildren();
}
