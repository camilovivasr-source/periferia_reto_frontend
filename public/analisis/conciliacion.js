import { consultarAnalisis } from '../api.js';
import { el } from '../dom.js';
import { kpi, numero, pct, semaforo, tabla, tarjeta } from './graficos.js';

const dif = (n) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n.toLocaleString('es-CO')} %`);
const texto = (estado, d) => (estado === 'sin_dato' ? 'Sin dato' : estado === 'ok' ? `En tolerancia (${dif(d)})` : `Fuera: ${dif(d)}`);

/** 3 · Conciliacion documental: solicitud vs cotizacion vs factura, con semaforo y coherencia del IVA. */
export async function renderConciliacion(raiz) {
  const d = await consultarAnalisis('conciliacion');
  const r = d.resumen;
  const kpis = el('div', 'kpis');
  kpis.append(
    kpi(String(r.en_tolerancia), `cotizaciones dentro de ±${d.tolerancia_pct} %`, 'bueno'),
    kpi(String(r.con_alerta), 'con alerta', r.con_alerta ? 'malo' : ''),
    kpi(String(r.sin_cotizacion), 'sin cotización', r.sin_cotizacion ? 'aviso' : ''),
  );
  const t = tabla(
    [
      { titulo: 'Caso', celda: (f) => `${f.caso} · ${f.proveedor}` },
      { titulo: 'Solicitud', celda: (f) => `${f.moneda} ${numero(f.valor_solicitud)}` },
      { titulo: 'Cotización', celda: (f) => numero(f.valor_cotizacion) },
      { titulo: 'vs cotización', celda: (f) => semaforo(f.semaforo_cotizacion, texto(f.semaforo_cotizacion, f.diferencia_cotizacion_pct)) },
      { titulo: 'Factura', celda: (f) => numero(f.valor_factura) },
      { titulo: 'vs factura', celda: (f) => semaforo(f.semaforo_factura, texto(f.semaforo_factura, f.diferencia_factura_pct)) },
      { titulo: 'IVA cotización', celda: (f) => (f.tasa_iva_cotizacion === null ? '—' : `${pct(f.tasa_iva_cotizacion * 100)} (${f.indicador_iva})`) },
      { titulo: 'IVA coherente', celda: (f) => (f.iva_coherente === null ? '—' : semaforo(f.iva_coherente ? 'ok' : 'alerta', f.iva_coherente ? 'Sí' : 'No')) },
    ],
    d.filas,
  );
  raiz.replaceChildren(
    kpis,
    tarjeta('Conciliación documental', 'tolerancia del PRD (RC5): 2 %', t, el('p', 'nota', 'La diferencia se mide contra el valor de la solicitud. El IVA de la cotización (IVA ÷ base gravable) se compara con la tasa del indicador en el maestro.')),
  );
}
