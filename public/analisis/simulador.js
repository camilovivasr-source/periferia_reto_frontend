import { consultarAnalisis, consultarDetalleCaso, simular } from '../api.js';
import { el } from '../dom.js';
import { tarjeta } from './graficos.js';

const ETIQUETA = { NO_APTA: ['malo', 'No apta'], APTA_CON_CONFIRMACION: ['aviso', 'Apta con confirmación'], APTA: ['bueno', 'Apta'] };
const sello = (v) => el('span', `sello ${ETIQUETA[v][0]}`, ETIQUETA[v][1]);

/** Campos del formulario: [clave, etiqueta, tipo]. Los selects se llenan con las opciones de los maestros. */
const CAMPOS = [
  ['valor_total', 'Valor total', 'number'], ['cantidad', 'Cantidad', 'number'], ['valor_unitario', 'Valor unitario', 'number'],
  ['centro_costo', 'Centro de costo', 'centro'], ['subarea', 'Subárea', 'subarea'], ['proveedor_nit', 'NIT del proveedor', 'text'],
  ['indicador_iva', 'Indicador de IVA', 'iva'], ['condiciones_pago', 'Condiciones de pago', 'pago'], ['fecha_solicitud', 'Fecha de la solicitud', 'date'],
  ['aprobador_email', 'Aprobador (correo)', 'text'], ['cotizacion_total', 'Total de la cotización', 'number'], ['fecha_factura', 'Fecha de la factura', 'date'],
];

function campo(clave, etiqueta, tipo, valores, opciones) {
  const id = `sim-${clave}`;
  const caja = el('label', 'campo-etiquetado');
  caja.htmlFor = id;
  caja.append(el('span', undefined, etiqueta));
  let control;
  if (['centro', 'subarea', 'iva', 'pago'].includes(tipo)) {
    control = el('select', 'campo');
    const lista = tipo === 'centro' ? opciones.centros.map((c) => [c.centro_costo, c.centro_costo])
      : tipo === 'subarea' ? (opciones.centros.find((c) => c.centro_costo === valores.centro_costo)?.subareas ?? []).map((s) => [s, s])
      : tipo === 'iva' ? [['', '(sin indicador)'], ...opciones.indicadores_iva.map((i) => [i.codigo, `${i.codigo} · ${i.descripcion}`])]
      : [['', '(sin condición)'], ...opciones.condiciones_pago.map((c) => [c.codigo, `${c.codigo} · ${c.descripcion}`])];
    for (const [v, t] of lista) control.append(new Option(t, v));
  } else {
    control = el('input', 'campo');
    control.type = tipo;
    if (tipo === 'number') control.step = 'any';
  }
  control.id = id;
  control.name = clave;
  const actual = valores[clave];
  control.value = actual === null || actual === undefined ? '' : String(actual);
  control.dataset.original = control.value;
  caja.append(control);
  return caja;
}

function resultado(r) {
  const cab = el('div', 'veredictos');
  cab.append(el('span', undefined, 'Antes'), sello(r.veredicto_original), el('span', 'flecha', '→'), el('span', undefined, 'Después'), sello(r.veredicto_simulado));
  const lista = el('ul', 'diferencias');
  for (const d of r.diferencias) {
    const li = el('li');
    li.append(el('strong', undefined, `${d.codigo} · ${d.regla}`), el('div', 'dif-linea', `Antes (${d.antes.estado}): ${d.antes.detalle}`), el('div', 'dif-linea nuevo', `Ahora (${d.despues.estado}): ${d.despues.detalle}`));
    lista.append(li);
  }
  return [cab, r.diferencias.length ? lista : el('p', 'nota', 'Ningún control cambió con esos valores.')];
}

/** 4 · Simulador "que pasaria si": revalida un caso con cambios hipoteticos (todo en memoria). */
export async function renderSimulador(raiz) {
  const { casos } = await consultarAnalisis('conciliacion').then((d) => ({ casos: d.filas.map((f) => f.caso) }));
  const selector = el('select', 'campo');
  selector.setAttribute('aria-label', 'Solicitud a simular');
  for (const c of casos) selector.append(new Option(c, c));

  const form = el('form', 'formulario-sim');
  const salida = el('div', 'salida-sim');
  const marcas = el('div', 'marcas');

  async function cargar() {
    const { valores, opciones } = await consultarDetalleCaso(selector.value);
    form.replaceChildren();
    const rejilla = el('div', 'rejilla-campos');
    for (const [clave, etiqueta, tipo] of CAMPOS) rejilla.append(campo(clave, etiqueta, tipo, valores, opciones));
    rejilla.querySelector('[name="centro_costo"]').addEventListener('change', (e) => {
      const subareas = opciones.centros.find((c) => c.centro_costo === e.target.value)?.subareas ?? [];
      const sel = rejilla.querySelector('[name="subarea"]');
      sel.replaceChildren(...subareas.map((s) => new Option(s, s)));
    });
    marcas.replaceChildren();
    for (const [clave, texto, activa] of [['quitar_cotizacion', 'Quitar la cotización', valores.hay_cotizacion], ['quitar_factura', 'Quitar la factura', valores.hay_factura], ['aprobacion_aprobada', 'El correo dice «Aprobado»', valores.aprobacion_aprobada !== null]]) {
      if (!activa) continue;
      const l = el('label', 'marca');
      const c = el('input');
      c.type = 'checkbox';
      c.name = clave;
      c.checked = clave === 'aprobacion_aprobada' ? valores.aprobacion_aprobada : false;
      c.dataset.original = String(c.checked);
      l.append(c, texto);
      marcas.append(l);
    }
    const acciones = el('div', 'acciones');
    const enviar = el('button', 'boton', 'Simular');
    enviar.type = 'submit';
    const restablecer = el('button', 'boton secundario', 'Restablecer');
    restablecer.type = 'button';
    restablecer.addEventListener('click', cargar);
    acciones.append(enviar, restablecer);
    form.append(rejilla, marcas, acciones);
    salida.replaceChildren(el('p', 'nota', `Valores actuales de ${selector.value}. Cambia lo que quieras: nada se guarda.`));
  }

  function cambios() {
    const c = {};
    for (const [clave, , tipo] of CAMPOS) {
      const i = form.elements[clave];
      if (!i || i.value === i.dataset.original) continue;
      c[clave] = tipo === 'number' ? Number(i.value) : (clave === 'indicador_iva' || clave === 'condiciones_pago') && i.value === '' ? null : i.value;
    }
    for (const m of marcas.querySelectorAll('input')) if (String(m.checked) !== m.dataset.original) c[m.name] = m.checked;
    return c;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const c = cambios();
      if (!Object.keys(c).length) { salida.replaceChildren(el('p', 'nota', 'No cambiaste nada todavía.')); return; }
      salida.replaceChildren(...resultado(await simular(selector.value, c)));
    } catch (err) {
      salida.replaceChildren(el('p', 'nota aviso', err.message));
    }
  });
  selector.addEventListener('change', cargar);

  const fila = el('label', 'campo-etiquetado');
  fila.append(el('span', undefined, 'Solicitud'), selector);
  raiz.replaceChildren(
    tarjeta('Simulador de controles', '¿qué pasaría si…? en memoria: no crea ni modifica nada', fila, form),
    tarjeta('Resultado', 'qué controles cambian', salida),
  );
  await cargar();
}
