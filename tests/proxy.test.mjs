import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createServer } from 'node:http';

let falso, falsoUrl, front, base;
const vistos = [];

before(async () => {
  falso = createServer((req, res) => {
    vistos.push(`${req.method} ${req.url} auth=${req.headers.authorization ?? '-'}`);
    if (req.url === '/api/chat') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"tipo":"complete","reply":"hola"}\n\n');
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ruta: req.url }));
  });
  await new Promise((r) => falso.listen(0, '127.0.0.1', r));
  falsoUrl = `http://127.0.0.1:${falso.address().port}`;
  process.env.BACKEND_URL = falsoUrl;
  process.env.BACKEND_AUTH = 'none';
  const { server } = await import('../src/server.mjs');
  front = server;
  await new Promise((r) => front.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${front.address().port}`;
});
after(() => { front.close(); falso.close(); });

describe('Proxy del frontend', () => {
  it('sirve la pagina, el cliente y las cabeceras de seguridad', async () => {
    const r = await fetch(base + '/');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Agente de órdenes de compra/);
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    for (const a of ['/app.js', '/markdown.js', '/cards.js', '/api.js', '/dom.js', '/sesion.js', '/vista-casos.js', '/vista-chat.js', '/avisos.js', '/nueva-solicitud.js', '/analisis/index.js', '/analisis/graficos.js', '/analisis/panel.js', '/analisis/desvio.js', '/analisis/conciliacion.js', '/analisis/simulador.js', '/analisis/autoridad.js', '/styles.css']) assert.equal((await fetch(base + a)).status, 200, a);
  });

  it('health propio y salud del backend por proxy', async () => {
    assert.equal((await (await fetch(base + '/health')).json()).service, 'frontend');
    const j = await (await fetch(base + '/api/backend-health')).json();
    assert.equal(j.ruta, '/api/health');
  });

  it('reenvia chat (SSE), casos y sesiones', async () => {
    const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ sessionId: 'sesion-12345', message: 'hola' }) });
    assert.match(await r.text(), /"reply":"hola"/);
    assert.equal((await (await fetch(base + '/api/casos')).json()).ruta, '/api/casos');
    assert.equal((await (await fetch(base + '/api/sessions/sesion-12345')).json()).ruta, '/api/sessions/sesion-12345');
  });

  it('reenvia las rutas de analisis (con query solo en autoridad) y la simulacion por POST', async () => {
    assert.equal((await (await fetch(base + '/api/analisis/panel?x=1')).json()).ruta, '/api/analisis/panel');
    assert.equal((await (await fetch(base + '/api/analisis/autoridad?centro=CC-1010&monto=100')).json()).ruta, '/api/analisis/autoridad?centro=CC-1010&monto=100');
    assert.equal((await (await fetch(base + '/api/analisis/caso/sol-004')).json()).ruta, '/api/analisis/caso/sol-004');
    const r = await fetch(base + '/api/analisis/simular', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caso: 'sol-004', cambios: { valor_total: 1 } }) });
    assert.equal((await r.json()).ruta, '/api/analisis/simular');
    assert.equal((await fetch(base + '/api/exportar/carga-sap.csv')).status, 200);
    assert.equal((await (await fetch(base + '/api/opciones')).json()).ruta, '/api/opciones');
    const alta = await fetch(base + '/api/solicitudes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal((await alta.json()).ruta, '/api/solicitudes');
  });

  it('no expone rutas que no son del chat ni acepta otros origenes', async () => {
    for (const ruta of ['/api/analisis/otra', '/api/analisis/caso/x', '/api/archivos/sol-001/secreto.txt', '/api/confirmar', '/api/solicitudes', '/../package.json', '/src/server.mjs', '/.env']) assert.equal((await fetch(base + ruta)).status, 404, ruta);
    const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://malo.example' }, body: '{}' });
    assert.equal(r.status, 403);
    assert.ok(!vistos.some((v) => v.includes('/api/confirmar')));
  });

  it('limita el tamano de la entrada', async () => {
    const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(20000) }) });
    assert.equal(r.status, 413);
  });
});
