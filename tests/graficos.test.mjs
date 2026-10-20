import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { JSDOM } from 'jsdom';

let g;
before(async () => {
  const { window } = new JSDOM('<!doctype html><body></body>');
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  g = await import('../public/analisis/graficos.js');
});

describe('Graficos de analisis (DOM, sin librerias)', () => {
  it('barra apilada: un segmento por valor positivo y leyenda con porcentajes', () => {
    const b = g.barraApilada([{ etiqueta: 'Creada', valor: 2, clase: 'bueno' }, { etiqueta: 'Bloqueada', valor: 2, clase: 'malo' }, { etiqueta: 'Lista', valor: 0, clase: 'info' }]);
    assert.equal(b.querySelectorAll('.segmento').length, 2);
    assert.match(b.textContent, /Creada · 2 \(50 %\)/);
  });

  it('linea de tiempo: un punto por evento, ordenado por fecha, texto sin HTML', () => {
    const t = g.lineaTiempo([{ tipo: 'cotizacion', fecha: '2026-08-05' }, { tipo: 'factura', fecha: '2026-08-10' }, { tipo: 'solicitud', fecha: '2026-08-27' }]);
    assert.equal(t.querySelectorAll('circle').length, 3);
    assert.equal(t.querySelectorAll('.ev-leyenda li').length, 3);
    const xs = [...t.querySelectorAll('circle')].map((c) => Number(c.getAttribute('cx')));
    assert.deepEqual(xs, [...xs].sort((a, b) => a - b));
  });

  it('la OC aparece en la leyenda pero no distorsiona la escala', () => {
    const t = g.lineaTiempo([{ tipo: 'solicitud', fecha: '2026-08-20' }, { tipo: 'aprobacion', fecha: '2026-08-21' }, { tipo: 'oc', fecha: '2026-10-20', detalle: '4500000001' }]);
    assert.equal(t.querySelectorAll('circle').length, 2);
    assert.match(t.textContent, /OC · 2026-10-20 · 4500000001/);
  });

  it('linea de tiempo con un solo evento no divide por cero', () => {
    const t = g.lineaTiempo([{ tipo: 'solicitud', fecha: '2026-08-27' }]);
    assert.equal(Number(t.querySelector('circle').getAttribute('cx')), 320);
  });

  it('tabla: escapa el contenido y muestra mensaje cuando no hay filas', () => {
    const t = g.tabla([{ titulo: 'x', celda: (f) => f.v }], [{ v: '<img src=x onerror=alert(1)>' }]);
    assert.equal(t.querySelector('img'), null);
    assert.match(g.tabla([{ titulo: 'x', celda: () => '' }], [], 'Nada').textContent, /Nada/);
  });

  it('lista de barras: el ancho es proporcional y se limita a 100 %', () => {
    const l = g.listaBarras([{ etiqueta: 'a', valor: 50 }, { etiqueta: 'b', valor: 150 }], 100);
    const anchos = [...l.querySelectorAll('.relleno')].map((r) => r.style.width);
    assert.deepEqual(anchos, ['50%', '100%']);
  });

  it('formato numerico', () => {
    assert.equal(g.numero(1000), '1.000');
    assert.equal(g.numero(null), '—');
    assert.equal(g.pct(16.7), '16,7 %');
  });
});
