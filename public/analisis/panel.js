import { consultarAnalisis } from '../api.js';
import { el } from '../dom.js';
import { barraApilada, kpi, listaBarras, numero, pct, tabla, tarjeta } from './graficos.js';

const COP = (n) => `COP ${numero(n)}`;

/** 1 · Panel de control: KPIs de la cartera, reglas que mas frenan y bitacora de intentos. */
export async function renderPanel(raiz) {
  const d = await consultarAnalisis('panel');
  const k = d.kpis;
  const e = k.por_estado;

  const kpis = el('div', 'kpis');
  kpis.append(
    kpi(String(e.CREADA), 'OC creadas', 'bueno'),
    kpi(String(e.REQUIERE_CONFIRMACION + e.APTA), 'por crear', 'aviso'),
    kpi(String(e.BLOQUEADA), 'bloqueadas', 'malo'),
    kpi(pct(k.automatizables_pct), 'sin intervención humana'),
    kpi(pct(k.retroactivas_pct), `retroactivas (${k.retroactivas})`, k.retroactivas ? 'aviso' : ''),
    kpi(`${k.minutos_ahorrados} min`, `ahorro estimado (${k.minutos_manuales_por_oc} min/OC)`),
    kpi(COP(k.valor_comprometido), 'comprometido en OC'),
    kpi(COP(k.valor_solicitado), 'solicitado en total'),
  );

  const estados = barraApilada([
    { etiqueta: 'Creada', valor: e.CREADA, clase: 'bueno' },
    { etiqueta: 'Lista', valor: e.APTA, clase: 'info' },
    { etiqueta: 'Requiere confirmación', valor: e.REQUIERE_CONFIRMACION, clase: 'aviso' },
    { etiqueta: 'Bloqueada', valor: e.BLOQUEADA, clase: 'malo' },
  ]);

  const reglas = listaBarras(
    d.reglas.map((r) => ({ etiqueta: `${r.codigo} · ${r.regla}`, valor: r.bloqueos + r.confirmaciones, detalle: `${r.bloqueos} bloqueo(s) · ${r.confirmaciones} confirmación(es)`, clase: r.bloqueos ? 'malo' : 'aviso' })),
  );

  // Bitacora con filtro por resultado.
  const filtro = el('select', 'campo');
  filtro.setAttribute('aria-label', 'Filtrar bitácora por resultado');
  for (const v of ['Todos', ...new Set(d.bitacora.map((f) => f.resultado))]) filtro.append(new Option(v, v));
  const contenedor = el('div');
  const pintar = () => {
    const filas = d.bitacora.filter((f) => filtro.value === 'Todos' || f.resultado === filtro.value);
    contenedor.replaceChildren(tabla(
      [
        { titulo: 'Fecha', celda: (f) => f.ts.replace('T', ' ').slice(0, 19) },
        { titulo: 'Solicitud', celda: (f) => f.solicitud_id },
        { titulo: 'Resultado', celda: (f) => f.resultado },
        { titulo: 'OC', celda: (f) => f.numero_oc || '—' },
        { titulo: 'Retro.', celda: (f) => (f.retroactiva ? 'Sí' : 'No') },
        { titulo: 'Bloqueos', celda: (f) => f.bloqueos.join(', ') || '—' },
        { titulo: 'Confirmaciones', celda: (f) => f.confirmaciones.join(', ') || '—' },
      ],
      filas,
      'Aún no hay intentos: procesa una solicitud en el asistente.',
    ));
  };
  filtro.addEventListener('change', pintar);
  pintar();

  const acciones = el('div', 'descargas');
  for (const [href, texto] of [['/api/exportar/carga-sap.csv', 'Exportar carga masiva SAP (CSV)'], ['/api/control.csv', 'Descargar control.csv']]) {
    const a = el('a', 'boton-enlace', texto);
    a.href = href;
    a.setAttribute('download', '');
    acciones.append(a);
  }
  const nota = el('p', 'nota', `El ahorro es una estimación: ${k.minutos_manuales_por_oc} min de digitación manual por OC (configurable con MINUTOS_MANUALES_POR_OC).`);

  raiz.replaceChildren(
    kpis,
    el('div', 'rejilla-2', undefined),
  );
  const fila = raiz.querySelector('.rejilla-2');
  fila.append(tarjeta('Estado de la cartera', `${k.casos} solicitudes`, estados), tarjeta('Controles que más frenan', 'bloqueos y confirmaciones por regla', reglas));
  raiz.append(tarjeta('Bitácora de intentos', `${k.intentos} registro(s) · control.csv`, filtro, contenedor), tarjeta('Exportar', 'Plan B de integración con SAP', acciones, nota));
}
