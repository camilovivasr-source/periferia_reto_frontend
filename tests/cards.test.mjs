import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JSDOM } from 'jsdom';
import { tarjetaPara, dinero, nombrePaso } from '../public/cards.js';

const { document } = new JSDOM('<!doctype html><body></body>').window;
const texto = (n) => n.textContent.replace(/\s+/g, ' ');

const validacion = {
  solicitud_id: 'SOL-2026-004', apta: true, retroactiva: false,
  confirmaciones: [{ codigo: 'RC5', detalle: 'la cotizacion suma 26.500.000 y la solicitud 25.000.000' }], bloqueos: [],
  controles: [
    { codigo: 'RC1', regla: 'Proveedor existe y esta activo', estado: 'CUMPLE', detalle: 'Cloud Andina' },
    { codigo: 'RC5', regla: 'Cotizacion coincide', estado: 'CONFIRMA', detalle: 'la cotizacion suma 26.500.000' },
    { codigo: 'RC7', regla: 'Condiciones de pago', estado: 'DERIVADO', detalle: 'Z000' },
  ],
};

describe('Tarjetas', () => {
  it('controles: veredicto y un renglon por control con su estado', () => {
    const t = tarjetaPara(document, { nombre: 'oc_validar', ok: true, args: { caso: 'sol-004' }, resultado: validacion });
    assert.match(texto(t), /Apta con confirmación/);
    assert.equal(t.querySelectorAll('li.control').length, 3);
    assert.equal(t.querySelectorAll('li.control.confirma').length, 1);
    assert.equal(t.querySelectorAll('li.control.cumple').length, 1);
  });

  it('no apta se marca como bloqueo', () => {
    const t = tarjetaPara(document, { nombre: 'oc_validar', ok: true, args: {}, resultado: { ...validacion, apta: false, bloqueos: [{ codigo: 'RC1', detalle: 'x' }], controles: [{ codigo: 'RC1', regla: 'r', estado: 'BLOQUEA', detalle: 'proveedor inexistente' }] } });
    assert.match(texto(t), /No apta/);
    assert.equal(t.querySelectorAll('li.control.bloquea').length, 1);
  });

  it('orden de compra: proveedor, posiciones, totales, excepciones y descargas', () => {
    const payload = {
      referencia: { solicitud_id: 'SOL-2026-004' }, sociedad: '1000', organizacion_compras: '1000', moneda: 'COP', condiciones_pago: 'Z000',
      proveedor: { codigo_sap: '100310', nit: '901222333', nombre: 'Cloud Andina S.A.S.' },
      aprobador: { email: 'dgarcia@periferia-ficticia.com', fecha_aprobacion: '2026-08-26T18:45:00-05:00', evidencia_sha256: 'a'.repeat(64) },
      posiciones: [{ numero: 10, descripcion: 'Bolsa de 100 horas', cantidad: 100, unidad: 'H', precio_unitario: 250000, precio_incluye_iva: true, centro_costo: 'CC-1010', subarea: 'Desarrollo', indicador_iva: 'C1' }],
      totales: { base: 21008403, iva: 3991597, total: 25000000 },
      excepciones: [{ codigo: 'RC5', detalle: 'diferencia 6 %', confirmado_por: null }],
    };
    const t = tarjetaPara(document, { nombre: 'oc_construir_payload', ok: true, args: { caso: 'sol-004' }, resultado: { payload } });
    const s = texto(t);
    assert.match(s, /Cloud Andina S\.A\.S\. · SAP 100310/);
    assert.match(s, /CC-1010 \/ Desarrollo/);
    assert.match(s, /COP 25\.000\.000/);
    assert.match(s, /Excepciones a confirmar/);
    assert.deepEqual([...t.querySelectorAll('a')].map((a) => a.getAttribute('href')), ['/api/archivos/sol-004/aprobacion.pdf', '/api/archivos/sol-004/aprobacion.txt', '/api/archivos/sol-004/trazabilidad.json']);
  });

  it('resultado de creacion: exito con numero y bloqueo con motivo', () => {
    const ok = tarjetaPara(document, { nombre: 'oc_crear', ok: true, args: {}, resultado: { numero_oc: '4500000001', idempotente: false, retroactiva: true } });
    assert.match(texto(ok), /OC creada en SAP/);
    assert.match(texto(ok), /4500000001/);
    assert.match(texto(ok), /retroactiva/);
    const mal = tarjetaPara(document, { nombre: 'oc_crear', ok: false, args: {}, resultado: { error: 'No se crea la OC', bloqueos: [{ codigo: 'RC1' }] } });
    assert.match(texto(mal), /No se creó la OC/);
    const pend = tarjetaPara(document, { nombre: 'oc_crear', ok: false, args: {}, resultado: { error: 'Falta la confirmacion', requiere_confirmacion: true } });
    assert.match(texto(pend), /Falta tu confirmación/);
  });

  it('casos y control; herramientas de lectura sin tarjeta propia', () => {
    const c = tarjetaPara(document, { nombre: 'oc_listar_casos', ok: true, args: {}, resultado: [{ caso: 'sol-001', proveedor: 'TecnoSuministros', valor_total: 11400000, moneda: 'COP', estado: 'CREADA', numero_oc: '4500000001' }] });
    assert.match(texto(c), /sol-001/); assert.match(texto(c), /Creada · 4500000001/);
    const k = tarjetaPara(document, { nombre: 'oc_resumen_control', ok: true, args: {}, resultado: { intentos: 5, oc_creadas: [1, 2], oc_retroactivas: 1, porcentaje_retroactivas: 50, ruta: 'out/control.csv' } });
    assert.match(texto(k), /50 %/);
    assert.equal(tarjetaPara(document, { nombre: 'oc_leer_paquete', ok: true, args: {}, resultado: {} }), null);
  });

  it('no interpreta HTML venido de los documentos', () => {
    const t = tarjetaPara(document, { nombre: 'oc_validar', ok: true, args: {}, resultado: { ...validacion, controles: [{ codigo: 'RC2', regla: '<img src=x onerror=alert(1)>', estado: 'BLOQUEA', detalle: '<script>alert(2)</script>' }] } });
    assert.equal(t.querySelector('img'), null);
    assert.equal(t.querySelector('script'), null);
  });

  it('helpers', () => { assert.equal(dinero(1000, 'COP'), 'COP 1.000'); assert.equal(nombrePaso('oc_validar'), 'Validar'); });
});

describe('Aislamiento de estilos', () => {
  it('las tarjetas no reutilizan clases de otros componentes (.control, .casos, .caso)', () => {
    const k = tarjetaPara(document, { nombre: 'oc_resumen_control', ok: true, args: {}, resultado: { intentos: 0, oc_creadas: [], oc_retroactivas: 0, porcentaje_retroactivas: 0, ruta: 'out/control.csv' } });
    const c = tarjetaPara(document, { nombre: 'oc_listar_casos', ok: true, args: {}, resultado: [] });
    for (const t of [k, c]) {
      assert.ok(!t.classList.contains('control') && !t.classList.contains('casos'), t.className);
    }
    assert.ok(k.classList.contains('t-control') && c.classList.contains('t-casos'));
  });
});
