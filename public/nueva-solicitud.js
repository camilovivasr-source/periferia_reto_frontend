import { el } from './dom.js';

const hoy = () => new Date().toISOString().slice(0, 10);

/** Campos del formulario: [nombre, etiqueta, tipo, requerido]. */
const SOLICITUD = [
  ['solicitante', 'Solicitante', 'text', true], ['solicitante_email', 'Correo del solicitante', 'email', true],
  ['proveedor', 'Proveedor', 'proveedor', true], ['descripcion', 'Descripción', 'text', true],
  ['centro_costo', 'Centro de costo', 'centro', true], ['subarea', 'Subárea', 'subarea', true],
  ['cantidad', 'Cantidad', 'number', true], ['valor_unitario', 'Valor unitario (IVA incl.)', 'number', true],
  ['valor_total', 'Valor total', 'number', true], ['moneda', 'Moneda', 'moneda', true],
  ['indicador_iva', 'Indicador de IVA', 'iva', false], ['condiciones_pago', 'Condiciones de pago', 'pago', false],
  ['fecha_solicitud', 'Fecha de la solicitud', 'date', true],
];

function control(nombre, tipo, opciones, requerido) {
  let c;
  const opcionesDe = {
    proveedor: [...opciones.proveedores.map((p) => [p.nit, `${p.nombre} · ${p.nit}${p.activo ? '' : ' (inactivo)'}`]), ['otro', 'Otro (no está en el maestro)']],
    centro: opciones.centros.map((x) => [x.centro_costo, `${x.centro_costo} · ${x.nombre}`]),
    subarea: (opciones.centros[0]?.subareas ?? []).map((s) => [s, s]),
    moneda: [['COP', 'COP'], ['USD', 'USD']],
    iva: [['', '(no informado)'], ...opciones.indicadores_iva.map((i) => [i.codigo, `${i.codigo} · ${i.descripcion}`])],
    pago: [['', '(no informadas)'], ...opciones.condiciones_pago.map((p) => [p.codigo, `${p.codigo} · ${p.descripcion}`])],
  }[tipo];
  if (opcionesDe) {
    c = el('select', 'campo');
    for (const [v, t] of opcionesDe) c.append(new Option(t, v));
  } else {
    c = el('input', 'campo');
    c.type = tipo;
    if (tipo === 'number') { c.min = '0'; c.step = 'any'; }
    if (tipo === 'date') c.value = hoy();
  }
  c.name = nombre;
  c.required = requerido;
  return c;
}

function etiquetado(texto, nodo) {
  const l = el('label', 'campo-etiquetado');
  l.append(el('span', undefined, texto), nodo);
  return l;
}

/** Arma el cuerpo para POST /api/solicitudes a partir del formulario. */
export function leerFormulario(form, opciones) {
  const v = (n) => form.elements[n]?.value?.trim() ?? '';
  const num = (n) => Number(v(n));
  const proveedor = opciones.proveedores.find((p) => p.nit === v('proveedor'));
  const solicitud = {
    solicitante: v('solicitante'), solicitante_email: v('solicitante_email'),
    proveedor_nombre: proveedor?.nombre ?? v('proveedor_otro'), ...(proveedor ? { proveedor_nit: proveedor.nit } : v('proveedor_nit_otro') ? { proveedor_nit: v('proveedor_nit_otro') } : {}),
    descripcion: v('descripcion'), centro_costo: v('centro_costo'), subarea: v('subarea'),
    cantidad: num('cantidad'), valor_unitario: num('valor_unitario'), valor_total: num('valor_total'), moneda: v('moneda'),
    ...(v('indicador_iva') ? { indicador_iva: v('indicador_iva') } : {}), ...(v('condiciones_pago') ? { condiciones_pago: v('condiciones_pago') } : {}),
    fecha_solicitud: v('fecha_solicitud'),
  };
  const cuerpo = { solicitud };
  if (form.elements.con_cotizacion.checked) cuerpo.cotizacion = { total: num('cot_total'), ...(v('cot_fecha') ? { fecha: v('cot_fecha') } : {}) };
  if (form.elements.con_aprobacion.checked) cuerpo.aprobacion = { de: v('apr_de'), fecha: v('apr_fecha'), cuerpo: v('apr_cuerpo') };
  if (form.elements.con_factura.checked) cuerpo.factura = { numero: v('fac_numero'), fecha: v('fac_fecha'), total: num('fac_total') };
  return cuerpo;
}

function bloqueOpcional(titulo, marca, campos, marcado) {
  const caja = el('fieldset', 'opcional');
  const leyenda = el('legend');
  const check = el('input');
  check.type = 'checkbox';
  check.name = marca;
  check.checked = marcado;
  leyenda.append(check, ` ${titulo}`);
  const rejilla = el('div', 'rejilla-campos');
  rejilla.append(...campos);
  const sincronizar = () => { rejilla.hidden = !check.checked; for (const i of rejilla.querySelectorAll('input,select,textarea')) i.disabled = !check.checked; };
  check.addEventListener('change', sincronizar);
  sincronizar();
  caja.append(leyenda, rejilla);
  return caja;
}

/**
 * Dialogo "Nueva solicitud": captura solicitud, cotizacion, aprobacion y factura (opcionales) y la registra.
 * El backend la guarda aparte de los fixtures y la valida con las mismas reglas.
 */
export function crearDialogoSolicitud({ cargarOpciones, registrar, alRegistrar }) {
  const dialogo = document.getElementById('dialogo-solicitud');
  const form = el('form', 'formulario-solicitud');
  const estado = el('div', 'estado-registro');
  let opciones = null;

  async function construir() {
    opciones = await cargarOpciones();
    const rejilla = el('div', 'rejilla-campos');
    for (const [nombre, etiqueta, tipo, req] of SOLICITUD) rejilla.append(etiquetado(etiqueta, control(nombre, tipo, opciones, req)));
    const otro = el('div', 'rejilla-campos proveedor-otro');
    const nombreOtro = el('input', 'campo'); nombreOtro.name = 'proveedor_otro';
    const nitOtro = el('input', 'campo'); nitOtro.name = 'proveedor_nit_otro';
    otro.append(etiquetado('Nombre del proveedor', nombreOtro), etiquetado('NIT (opcional)', nitOtro));
    otro.hidden = true;

    const aprobadores = el('datalist'); aprobadores.id = 'lista-aprobadores';
    const actualizarCentro = () => {
      const c = opciones.centros.find((x) => x.centro_costo === form.elements.centro_costo.value);
      form.elements.subarea.replaceChildren(...(c?.subareas ?? []).map((s) => new Option(s, s)));
      aprobadores.replaceChildren(...(c?.aprobadores ?? []).map((a) => new Option(a, a)));
    };
    const recalcular = () => { const t = Number(form.elements.cantidad.value) * Number(form.elements.valor_unitario.value); if (t) form.elements.valor_total.value = String(Math.round(t * 100) / 100); };

    const aprDe = el('input', 'campo'); aprDe.type = 'email'; aprDe.name = 'apr_de'; aprDe.setAttribute('list', 'lista-aprobadores'); aprDe.required = true;
    const aprFecha = control('apr_fecha', 'date', opciones, true);
    const aprCuerpo = el('input', 'campo'); aprCuerpo.name = 'apr_cuerpo'; aprCuerpo.value = 'Aprobado.'; aprCuerpo.required = true;
    const cotTotal = control('cot_total', 'number', opciones, true);
    const cotFecha = control('cot_fecha', 'date', opciones, false);
    const facNumero = el('input', 'campo'); facNumero.name = 'fac_numero'; facNumero.required = true;
    const facFecha = control('fac_fecha', 'date', opciones, true);
    const facTotal = control('fac_total', 'number', opciones, true);

    const acciones = el('div', 'acciones');
    const guardar = el('button', 'boton', 'Registrar solicitud'); guardar.type = 'submit';
    const cancelar = el('button', 'boton secundario', 'Cancelar'); cancelar.type = 'button';
    cancelar.addEventListener('click', () => dialogo.close());
    acciones.append(guardar, cancelar);

    form.replaceChildren(
      el('h2', undefined, 'Nueva solicitud de compra'),
      el('p', 'ayuda', 'Se guarda aparte de los casos entregados y pasa por los mismos controles. Deja sin marcar lo que no llegó en el correo: el agente lo tratará como faltante.'),
      rejilla, otro, aprobadores,
      bloqueOpcional('Cotización del proveedor', 'con_cotizacion', [etiquetado('Total de la cotización', cotTotal), etiquetado('Fecha', cotFecha)], true),
      bloqueOpcional('Correo de aprobación del líder', 'con_aprobacion', [etiquetado('Aprobador (correo)', aprDe), etiquetado('Fecha', aprFecha), etiquetado('Texto del correo', aprCuerpo)], true),
      bloqueOpcional('Factura (si ya llegó)', 'con_factura', [etiquetado('Número', facNumero), etiquetado('Fecha de emisión', facFecha), etiquetado('Total', facTotal)], false),
      estado, acciones,
    );
    form.elements.centro_costo.addEventListener('change', actualizarCentro);
    form.elements.cantidad.addEventListener('input', recalcular);
    form.elements.valor_unitario.addEventListener('input', recalcular);
    form.elements.proveedor.addEventListener('change', () => { otro.hidden = form.elements.proveedor.value !== 'otro'; nombreOtro.required = !otro.hidden; });
    form.elements.valor_total.addEventListener('input', () => { if (!cotTotal.value) cotTotal.value = form.elements.valor_total.value; });
    actualizarCentro();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    estado.className = 'estado-registro';
    estado.textContent = 'Registrando…';
    try {
      const r = await registrar(leerFormulario(form, opciones));
      dialogo.close();
      alRegistrar(r);
    } catch (err) {
      estado.className = 'estado-registro malo';
      estado.textContent = err.message;
    }
  });

  dialogo.append(form);
  return {
    async abrir() {
      estado.textContent = '';
      await construir();
      dialogo.showModal();
      form.querySelector('input')?.focus();
    },
  };
}
