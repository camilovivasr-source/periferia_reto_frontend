import { consultarAnalisis } from '../api.js';
import { el } from '../dom.js';
import { kpi, lineaTiempo, listaBarras, pct, semaforo, tarjeta } from './graficos.js';

/** 2 · Desvio de proceso: linea de tiempo por caso y retroactividad por centro y proveedor. */
export async function renderDesvio(raiz) {
  const d = await consultarAnalisis('desvio');
  const r = d.resumen;

  const kpis = el('div', 'kpis');
  kpis.append(
    kpi(String(r.retroactivas), 'OC retroactivas', r.retroactivas ? 'aviso' : 'bueno'),
    kpi(pct(r.porcentaje), 'del total de solicitudes'),
    kpi(`${r.dias_promedio_de_desvio} d`, 'desvío promedio (factura antes que solicitud)'),
  );

  const grupo = (filas) => listaBarras(filas.map((g) => ({ etiqueta: g.clave, valor: g.porcentaje, detalle: `${g.retroactivas}/${g.casos} · ${pct(g.porcentaje)}`, clase: g.retroactivas ? 'aviso' : 'bueno' })), 100);

  const lineas = el('div', 'timelines');
  for (const c of d.casos) {
    const caja = el('div', 'timeline-caso');
    const cab = el('div', 'timeline-cab');
    cab.append(el('strong', undefined, `${c.caso} · ${c.proveedor}`));
    cab.append(c.retroactiva ? semaforo('alerta', `Retroactiva · factura ${c.dias_factura_antes_de_solicitud} d antes`) : semaforo(c.secuencia_correcta ? 'ok' : 'alerta', c.secuencia_correcta ? 'Secuencia correcta' : 'Secuencia alterada'));
    caja.append(cab, lineaTiempo(c.eventos));
    lineas.append(caja);
  }
  const leyenda = el('p', 'nota', 'Secuencia esperada: cotización → solicitud → aprobación → factura → OC. Una factura anterior a la solicitud marca la OC como retroactiva; el agente no altera fechas, solo las mide.');

  const rejilla = el('div', 'rejilla-2');
  rejilla.append(tarjeta('Retroactivas por centro de costo', '% de solicitudes', grupo(d.por_centro)), tarjeta('Retroactivas por proveedor', '% de solicitudes', grupo(d.por_proveedor)));
  raiz.replaceChildren(kpis, rejilla, tarjeta('Línea de tiempo por solicitud', 'cuándo ocurrió cada documento', lineas, leyenda));
}
