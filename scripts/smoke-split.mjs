// Integracion local: backend compilado (modo practica, sin LLM) + este frontend, de punta a punta.
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const hijos = [];
async function iniciar(cwd, script, env) {
  const h = spawn(process.execPath, [script], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  hijos.push(h);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Inicio excedido: ${script}`)), 15000);
    h.once('exit', (c) => { clearTimeout(t); reject(new Error(`Proceso termino ${c}`)); });
    h.stdout.once('data', () => { clearTimeout(t); resolve(); });
  });
}
try {
  const backend = path.resolve(process.env.BACKEND_DIR ?? '../periferia_reto_backend');
  await iniciar(backend, 'dist/src/server.js', { PORT: '3037', AGENT_MODE: 'practice', GEMINI_API_KEY: '', OUT_DIR: path.join(process.env.TMPDIR ?? '/tmp', 'smoke-out') });
  await iniciar(process.cwd(), 'src/server.mjs', { PORT: '3038', BACKEND_URL: 'http://127.0.0.1:3037', BACKEND_AUTH: 'none' });
  const base = 'http://127.0.0.1:3038';
  assert.equal((await (await fetch(`${base}/health`)).json()).service, 'frontend');
  assert.equal((await (await fetch(`${base}/api/backend-health`)).json()).ok, true);
  const turno = async (message) => {
    const r = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ sessionId: 'smoke-sesion-1', message }) });
    const eventos = (await r.text()).split('\n\n').map((b) => b.split('\n').find((l) => l.startsWith('data: '))).filter(Boolean).map((l) => JSON.parse(l.slice(6)));
    return eventos;
  };
  const e1 = await turno('procesa sol-004');
  assert.ok(e1.some((e) => e.tipo === 'tool_start') && e1.some((e) => e.tipo === 'tool_end'));
  assert.equal(e1.at(-1).needsConfirmation, true);
  const e2 = await turno('confirmo');
  assert.match(e2.at(-1).reply, /OC 45000000\d\d/);
  const e3 = await turno('procesa sol-002');
  assert.ok(!e3.at(-1).toolCalls.some((c) => c.nombre === 'oc_crear'));
  console.log('Integracion frontend -> backend OK: herramientas visibles, confirmacion, creacion y bloqueo (modo practica, sin LLM ni IAM reales).');
} finally {
  for (const h of hijos) h.kill();
}
