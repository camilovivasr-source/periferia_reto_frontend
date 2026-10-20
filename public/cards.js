// Tarjetas estructuradas a partir de los resultados de las herramientas. Todo con nodos DOM (sin innerHTML):
// lo que viene del modelo o de los documentos nunca se interpreta como HTML.
const el = (doc, tag, clase, texto) => {
  const e = doc.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
};

export const dinero = (n, moneda = 'COP') => (typeof n === 'number' ? `${moneda} ${n.toLocaleString('es-CO')}` : '—');

const ESTADO = {
  CUMPLE: { icono: '✓', clase: 'cumple', texto: 'Cumple' },
  BLOQUEA: { icono: '✕', clase: 'bloquea', texto: 'Bloquea' },
  CONFIRMA: { icono: '!', clase: 'confirma', texto: 'Confirmar' },
  DERIVADO: { icono: '↳', clase: 'derivado', texto: 'Derivado' },
  NO_APLICA: { icono: '–', clase: 'noaplica', texto: 'No aplica' },
};

function envoltura(doc, clase, titulo, subtitulo) {
  const t = el(doc, 'section', `tarjeta ${clase}`);
  const cab = el(doc, 'header', 'tarjeta-cab');
  cab.append(el(doc, 'h4', null, titulo));
  if (subtitulo) cab.append(el(doc, 'span', 'subtitulo', subtitulo));
  t.append(cab);
  return { t, cab };
}

/** Resultado de oc_validar: veredicto y lista de controles RC. */
export function tarjetaControles(doc, d) {
  const veredicto = !d.apta ? 'No apta' : d.confirmaciones?.length ? 'Apta con confirmación' : 'Apta';
  const clase = !d.apta ? 'malo' : d.confirmaciones?.length ? 'aviso' : 'bueno';
  const { t, cab } = envoltura(doc, `controles ${clase}`, 'Controles', d.solicitud_id);
  cab.append(el(doc, 'span', `sello ${clase}`, veredicto));
  const lista = el(doc, 'ul', 'controles-lista');
  for (const c of d.controles ?? []) {
    const e = ESTADO[c.estado] ?? ESTADO.NO_APLICA;
    const li = el(doc, 'li', `control ${e.clase}`);
    li.append(el(doc, 'span', 'icono', e.icono), el(doc, 'strong', 'codigo', c.codigo));
    const cuerpo = el(doc, 'div', 'control-cuerpo');
    cuerpo.append(el(doc, 'span', 'regla', c.regla), el(doc, 'span', 'detalle', c.detalle));
    li.append(cuerpo);
    lista.append(li);
  }
  t.append(lista);
  if (d.retroactiva) t.append(el(doc, 'p', 'nota aviso', 'Compra retroactiva: queda marcada en el registro de control.'));
  return t;
}

const fila = (doc, k, v) => {
  const r = el(doc, 'div', 'fila');
  r.append(el(doc, 'dt', null, k), el(doc, 'dd', null, v));
  return r;
};

export function enlacesEvidencia(doc, caso) {
  const caja = el(doc, 'div', 'descargas');
  for (const [archivo, texto] of [['aprobacion.pdf', 'Evidencia PDF'], ['aprobacion.txt', 'Evidencia TXT'], ['trazabilidad.json', 'Trazabilidad']]) {
    const a = el(doc, 'a', 'boton-enlace', texto);
    a.href = `/api/archivos/${encodeURIComponent(caso)}/${archivo}`;
    a.setAttribute('download', '');
    caja.append(a);
  }
  return caja;
}

/** Resultado de oc_construir_payload: la OC como quedaria en SAP. */
export function tarjetaOrden(doc, d, caso) {
  const p = d.payload;
  const { t, cab } = envoltura(doc, 'orden', 'Orden de compra · borrador SAP', p.referencia?.solicitud_id);
  cab.append(el(doc, 'span', 'sello neutro', `Sociedad ${p.sociedad} · Org. compras ${p.organizacion_compras}`));
  const datos = el(doc, 'dl', 'datos');
  datos.append(
    fila(doc, 'Proveedor', `${p.proveedor.nombre} · SAP ${p.proveedor.codigo_sap} · NIT ${p.proveedor.nit}`),
    fila(doc, 'Condiciones de pago', p.condiciones_pago),
    fila(doc, 'Aprobador', `${p.aprobador.email} · ${String(p.aprobador.fecha_aprobacion).slice(0, 10)}`),
    fila(doc, 'Evidencia (sha256)', `${p.aprobador.evidencia_sha256.slice(0, 16)}…`),
  );
  t.append(datos);
  const tabla = el(doc, 'table', 'mini');
  const cabeza = el(doc, 'tr');
  for (const h of ['Pos.', 'Descripción', 'Cant.', 'Precio unit.', 'Centro / subárea', 'IVA']) cabeza.append(el(doc, 'th', null, h));
  tabla.append(cabeza);
  for (const x of p.posiciones) {
    const r = el(doc, 'tr');
    for (const v of [x.numero, x.descripcion, `${x.cantidad} ${x.unidad}`, dinero(x.precio_unitario, p.moneda) + (x.precio_incluye_iva ? ' (con IVA)' : ''), `${x.centro_costo} / ${x.subarea}`, x.indicador_iva]) r.append(el(doc, 'td', null, String(v)));
    tabla.append(r);
  }
  const caja = el(doc, 'div', 'tabla');
  caja.append(tabla);
  t.append(caja);
  const tot = el(doc, 'div', 'totales');
  for (const [k, v] of [['Base', p.totales.base], ['IVA', p.totales.iva], ['Total', p.totales.total]]) {
    const c = el(doc, 'div', k === 'Total' ? 'total grande' : 'total');
    c.append(el(doc, 'span', null, k), el(doc, 'strong', null, dinero(v, p.moneda)));
    tot.append(c);
  }
  t.append(tot);
  if (p.excepciones?.length) {
    const ex = el(doc, 'div', 'excepciones');
    ex.append(el(doc, 'strong', null, 'Excepciones a confirmar'));
    const ul = el(doc, 'ul');
    for (const e of p.excepciones) {
      const li = el(doc, 'li');
      li.append(el(doc, 'b', null, `${e.codigo}: `), e.detalle);
      ul.append(li);
    }
    ex.append(ul);
    t.append(ex);
  }
  if (caso) t.append(enlacesEvidencia(doc, caso));
  return t;
}

/** Resultado de oc_crear (exito, idempotente, pendiente o bloqueada). */
export function tarjetaResultado(doc, llamada) {
  const r = llamada.resultado ?? {};
  if (llamada.ok) {
    const { t } = envoltura(doc, `resultado exito`, r.idempotente ? 'La OC ya existía' : 'OC creada en SAP');
    const n = el(doc, 'div', 'numero-oc');
    n.append(el(doc, 'span', 'etiqueta', 'Número de OC'), el(doc, 'strong', null, r.numero_oc));
    t.append(n);
    const acciones = el(doc, 'div', 'descargas');
    const copiar = el(doc, 'button', 'boton-enlace', 'Copiar número');
    copiar.type = 'button';
    copiar.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(String(r.numero_oc)); copiar.textContent = 'Copiado ✓'; } catch { copiar.textContent = String(r.numero_oc); }
    });
    acciones.append(copiar);
    t.append(acciones);
    if (r.retroactiva) t.append(el(doc, 'p', 'nota aviso', 'Marcada como retroactiva en out/control.csv.'));
    if (r.idempotente) t.append(el(doc, 'p', 'nota', 'No se creó una segunda OC: se devolvió la existente.'));
    return t;
  }
  const bloqueada = Array.isArray(r.bloqueos) && r.bloqueos.length;
  const { t } = envoltura(doc, `resultado ${bloqueada ? 'malo' : 'aviso'}`, bloqueada ? 'No se creó la OC' : 'Falta tu confirmación');
  t.append(el(doc, 'p', 'nota', r.error ?? ''));
  return t;
}

const ETIQUETA_ESTADO = { CREADA: 'Creada', BLOQUEADA: 'Bloqueada', REQUIERE_CONFIRMACION: 'Requiere confirmación', APTA: 'Lista para crear', ERROR_DATOS: 'Error de datos' };
const CLASE_ESTADO = { CREADA: 'bueno', BLOQUEADA: 'malo', REQUIERE_CONFIRMACION: 'aviso', APTA: 'info', ERROR_DATOS: 'malo' };
export const etiquetaEstado = (e) => ETIQUETA_ESTADO[e] ?? e;
export const claseEstado = (e) => CLASE_ESTADO[e] ?? 'neutro';

/** Resultado de oc_listar_casos. */
export function tarjetaCasos(doc, casos) {
  const { t } = envoltura(doc, 'casos', 'Solicitudes', `${casos.length} casos`);
  const tabla = el(doc, 'table', 'mini');
  const cab = el(doc, 'tr');
  for (const h of ['Caso', 'Proveedor', 'Valor', 'Estado']) cab.append(el(doc, 'th', null, h));
  tabla.append(cab);
  for (const c of casos) {
    const r = el(doc, 'tr');
    const estado = el(doc, 'td');
    estado.append(el(doc, 'span', `sello ${claseEstado(c.estado)}`, etiquetaEstado(c.estado) + (c.numero_oc ? ` · ${c.numero_oc}` : '')));
    r.append(el(doc, 'td', null, c.caso), el(doc, 'td', null, c.proveedor ?? '—'), el(doc, 'td', null, dinero(c.valor_total, c.moneda ?? 'COP')), estado);
    tabla.append(r);
  }
  const caja = el(doc, 'div', 'tabla');
  caja.append(tabla);
  t.append(caja);
  return t;
}

/** Resultado de oc_resumen_control. */
export function tarjetaControl(doc, d) {
  const { t } = envoltura(doc, 'control', 'Registro de control', d.ruta);
  const tot = el(doc, 'div', 'totales');
  for (const [k, v] of [['Intentos', d.intentos], ['OC creadas', d.oc_creadas.length], ['Retroactivas', `${d.oc_retroactivas} (${d.porcentaje_retroactivas} %)`]]) {
    const c = el(doc, 'div', 'total');
    c.append(el(doc, 'span', null, k), el(doc, 'strong', null, String(v)));
    tot.append(c);
  }
  t.append(tot);
  const a = el(doc, 'a', 'boton-enlace', 'Descargar control.csv');
  a.href = '/api/control.csv';
  a.setAttribute('download', '');
  const caja = el(doc, 'div', 'descargas');
  caja.append(a);
  t.append(caja);
  return t;
}

/** Devuelve la tarjeta que corresponde a una llamada a herramienta, o null si solo va en el detalle técnico. */
export function tarjetaPara(doc, l) {
  const r = l.resultado;
  const caso = l.args?.caso;
  if (l.nombre === 'oc_validar' && l.ok && r?.controles) return tarjetaControles(doc, r);
  if (l.nombre === 'oc_construir_payload' && l.ok && r?.payload) return tarjetaOrden(doc, r, caso);
  if (l.nombre === 'oc_crear') return tarjetaResultado(doc, l);
  if (l.nombre === 'oc_listar_casos' && l.ok && Array.isArray(r)) return tarjetaCasos(doc, r);
  if (l.nombre === 'oc_resumen_control' && l.ok && r) return tarjetaControl(doc, r);
  return null;
}

const NOMBRE_PASO = { oc_leer_paquete: 'Leer', oc_validar: 'Validar', oc_construir_payload: 'Payload', oc_generar_evidencia: 'Evidencia', oc_crear: 'Crear', oc_listar_casos: 'Casos', oc_consultar_maestro: 'Maestro', oc_resumen_control: 'Control' };
export const nombrePaso = (n) => NOMBRE_PASO[n] ?? n;
