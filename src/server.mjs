import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAuth } from 'google-auth-library';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cloud = !!process.env.K_SERVICE;
const backend = new URL(process.env.BACKEND_URL ?? 'http://127.0.0.1:8080');
if (backend.pathname !== '/' || backend.search || backend.hash || !['http:', 'https:'].includes(backend.protocol)) {
  throw new Error('BACKEND_URL debe ser un origen HTTP(S), por ejemplo https://periferia-backend-xxxx.run.app');
}
const authMode = process.env.BACKEND_AUTH ?? 'iam';
if (!['iam', 'none'].includes(authMode) || (cloud && authMode !== 'iam')) throw new Error('En Cloud Run use BACKEND_AUTH=iam');

const auth = new GoogleAuth();
let clienteIam;
const limites = new Map();

const MODULOS_ANALISIS = ['index', 'graficos', 'panel', 'desvio', 'conciliacion', 'simulador', 'autoridad'];
const activos = {
  '/': ['public/index.html', 'text/html'],
  '/app.js': ['public/app.js', 'text/javascript'],
  '/cards.js': ['public/cards.js', 'text/javascript'],
  '/nueva-solicitud.js': ['public/nueva-solicitud.js', 'text/javascript'],
  '/markdown.js': ['public/markdown.js', 'text/javascript'],
  '/dom.js': ['public/dom.js', 'text/javascript'],
  '/sesion.js': ['public/sesion.js', 'text/javascript'],
  '/api.js': ['public/api.js', 'text/javascript'],
  '/vista-casos.js': ['public/vista-casos.js', 'text/javascript'],
  '/vista-chat.js': ['public/vista-chat.js', 'text/javascript'],
  '/avisos.js': ['public/avisos.js', 'text/javascript'],
  ...Object.fromEntries(MODULOS_ANALISIS.map((m) => [`/analisis/${m}.js`, [`public/analisis/${m}.js`, 'text/javascript']])),
  '/styles.css': ['public/styles.css', 'text/css'],
};
/** Lista cerrada de rutas que el proxy reenvia al backend (metodo + ruta). Devuelve la ruta destino o null. */
const SOLO_LECTURA = [
  /^\/api\/casos$/,
  /^\/api\/opciones$/,
  /^\/api\/control\.csv$/,
  /^\/api\/archivos\/sol-\d{3}\/(aprobacion\.pdf|aprobacion\.txt|trazabilidad\.json)$/,
  /^\/api\/sessions\/[A-Za-z0-9_-]{8,64}$/,
  /^\/api\/analisis\/(panel|desvio|conciliacion|autoridad)$/,
  /^\/api\/analisis\/caso\/sol-\d{3}$/,
  /^\/api\/exportar\/carga-sap\.csv$/,
];
const ESCRITURA = [/^\/api\/chat$/, /^\/api\/analisis\/simular$/, /^\/api\/solicitudes$/];

const rutaApi = (method, url) => {
  const { pathname, search } = new URL(url, 'http://local');
  if (method === 'GET' && pathname === '/api/backend-health') return '/api/health';
  const permitidas = method === 'GET' ? SOLO_LECTURA : method === 'POST' ? ESCRITURA : [];
  if (!permitidas.some((re) => re.test(pathname))) return null;
  // Solo la consulta de autoridad lleva parametros; el resto se reenvia sin query.
  return pathname === '/api/analisis/autoridad' ? pathname + search : pathname;
};

export const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  const enviar = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  try {
    const url = req.url ?? '/';
    if (req.method === 'GET' && url === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && url === '/health') return enviar(200, { ok: true, service: 'frontend' });
    const activo = req.method === 'GET' ? activos[url] : undefined;
    if (activo) {
      res.writeHead(200, { 'Content-Type': `${activo[1]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      return res.end(await readFile(path.join(raiz, activo[0])));
    }
    const destino = rutaApi(req.method, url);
    if (!destino) return enviar(404, { error: 'Ruta no encontrada' });
    if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return enviar(403, { error: 'Origen no permitido' });

    const ip = req.socket.remoteAddress ?? 'desconocida';
    const cubo = limites.get(ip);
    const ahora = Date.now();
    if (!cubo || ahora - cubo.inicio > 60_000) {
      if (limites.size > 10_000) limites.clear();
      limites.set(ip, { inicio: ahora, n: 1 });
    } else if (++cubo.n > 90) return enviar(429, { error: 'Demasiadas solicitudes. Espera un minuto.' });

    let tam = 0;
    const partes = [];
    for await (const parte of req) {
      tam += parte.length;
      if (tam > 16_384) return enviar(413, { error: 'Entrada demasiado grande' });
      partes.push(parte);
    }
    const cuerpo = Buffer.concat(partes);

    const cabeceras = { 'Content-Type': 'application/json' };
    if (req.headers.accept?.includes('text/event-stream')) cabeceras.Accept = 'text/event-stream';
    if (authMode === 'iam') {
      clienteIam ??= await auth.getIdTokenClient(backend.origin);
      const h = await clienteIam.getRequestHeaders();
      const autorizacion = h instanceof Headers ? h.get('authorization') : (h.Authorization ?? h.authorization);
      if (!autorizacion) throw new Error('Sin identidad IAM');
      cabeceras.Authorization = autorizacion;
    }
    const cancelar = new AbortController();
    res.on('close', () => cancelar.abort());
    const arriba = await fetch(new URL(destino, backend.origin), {
      method: req.method,
      headers: cabeceras,
      ...(req.method === 'POST' ? { body: cuerpo } : {}),
      signal: AbortSignal.any([cancelar.signal, AbortSignal.timeout(110_000)]),
    });
    const disposicion = arriba.headers.get('content-disposition');
    res.writeHead(arriba.status, { 'Content-Type': arriba.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no', ...(disposicion ? { 'Content-Disposition': disposicion } : {}) });
    if (arriba.body) for await (const trozo of arriba.body) if (!res.destroyed) res.write(trozo);
    res.end();
  } catch {
    if (!res.headersSent) enviar(502, { error: 'No se pudo contactar el backend. Revisa BACKEND_URL, IAM y el estado del servicio.' });
    else res.end();
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.requestTimeout = 120_000;
  server.listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () => console.log('Frontend listo'));
}
