import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JSDOM } from 'jsdom';
import { renderMarkdown } from '../public/markdown.js';

const { document } = new JSDOM('<!doctype html><body></body>').window;
const render = (md) => { const d = document.createElement('div'); d.append(renderMarkdown(document, md)); return d; };

describe('Render de Markdown seguro', () => {
  it('tablas, listas, negrita y codigo', () => {
    const d = render('**Total** `COP`\n\n| Campo | Valor |\n|---|---|\n| Proveedor | Cloud Andina |\n\n- RC5\n- RC8');
    assert.equal(d.querySelectorAll('table tr').length, 2);
    assert.equal(d.querySelector('td').textContent, 'Proveedor');
    assert.equal(d.querySelectorAll('li').length, 2);
    assert.equal(d.querySelector('strong').textContent, 'Total');
    assert.equal(d.querySelector('code').textContent, 'COP');
  });

  it('no interpreta HTML del modelo ni de los documentos (XSS)', () => {
    const d = render('<img src=x onerror="alert(1)"> <script>alert(2)</script> **ok**');
    assert.equal(d.querySelector('img'), null);
    assert.equal(d.querySelector('script'), null);
    assert.match(d.textContent, /<script>alert\(2\)<\/script>/);
  });
});
