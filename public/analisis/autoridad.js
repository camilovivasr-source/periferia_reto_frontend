import { consultarAnalisis, consultarAutoridad } from '../api.js';
import { el } from '../dom.js';
import { barra, numero, tarjeta } from './graficos.js';

/** 5 · Autoridad de aprobacion: matriz de topes, uso real y consulta "quien puede aprobar X en el centro Y". */
export async function renderAutoridad(raiz) {
  const { matriz } = await consultarAnalisis('autoridad');

  const consulta = el('form', 'formulario-linea');
  const centro = el('select', 'campo');
  centro.setAttribute('aria-label', 'Centro de costo');
  for (const c of matriz) centro.append(new Option(`${c.centro_costo} · ${c.nombre}`, c.centro_costo));
  const monto = el('input', 'campo');
  Object.assign(monto, { type: 'number', min: '1', step: '1', value: '30000000', required: true });
  monto.setAttribute('aria-label', 'Monto en COP');
  const boton = el('button', 'boton', 'Consultar');
  boton.type = 'submit';
  const respuesta = el('div', 'respuesta-autoridad');
  consulta.append(centro, monto, boton);
  consulta.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { consulta: c } = await consultarAutoridad(centro.value, monto.value);
      respuesta.className = `respuesta-autoridad ${c.requiere_escalar ? 'malo' : 'bueno'}`;
      respuesta.replaceChildren(
        c.requiere_escalar
          ? el('p', undefined, `Nadie en ${c.centro} puede aprobar COP ${numero(c.monto)}: el tope máximo es COP ${numero(c.tope_maximo)}. Hay que escalar a una autoridad superior.`)
          : el('p', undefined, `Pueden aprobar COP ${numero(c.monto)} en ${c.centro}: ${c.pueden_aprobar.map((p) => `${p.nombre} (tope COP ${numero(p.tope)}, holgura COP ${numero(p.holgura)})`).join('; ')}.`),
      );
    } catch (err) {
      respuesta.className = 'respuesta-autoridad malo';
      respuesta.textContent = err.message;
    }
  });

  const tarjetasCentro = matriz.map((c) => {
    const cuerpo = el('div', 'autoridad-centro');
    for (const a of c.aprobadores) {
      const bloque = el('div', 'aprobador');
      const cab = el('div', 'lb-cab');
      cab.append(el('strong', undefined, a.nombre), el('span', 'lb-valor', `tope COP ${numero(a.tope)}`));
      bloque.append(cab, el('div', 'email', a.email));
      if (!a.casos.length) bloque.append(el('p', 'nota', 'Sin solicitudes aprobadas en el periodo.'));
      for (const caso of a.casos) {
        const fila = el('div', 'uso');
        fila.append(el('span', undefined, `${caso.caso} · COP ${numero(caso.valor)} (${caso.uso_pct} % del tope)`), barra(caso.valor, a.tope, caso.dentro_del_tope ? 'bueno' : 'malo'));
        bloque.append(fila);
      }
      cuerpo.append(bloque);
    }
    for (const s of c.casos_sin_autoridad) {
      cuerpo.append(el('p', 'nota aviso', `${s.caso}: la aprobó ${s.aprobo ?? 'nadie'}, que no figura como aprobador de ${c.centro_costo}.`));
    }
    return tarjeta(`${c.centro_costo} · ${c.nombre}`, `subáreas: ${c.subareas.join(', ')}`, cuerpo);
  });

  raiz.replaceChildren(tarjeta('¿Quién puede aprobar…?', 'consulta de autoridad (RC2 y RC3)', consulta, respuesta), ...tarjetasCentro);
}
