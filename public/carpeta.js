import { el } from './dom.js';

const PERMITIDOS = new Set(['correo.json', 'solicitud.json', 'cotizacion.txt', 'aprobacion.json', 'factura.txt']);
const base = (ruta) => ruta.split('/').pop().toLowerCase();

/** Lee los archivos relevantes de una carpeta (FileList con webkitRelativePath, o entradas arrastradas). */
async function desdeFiles(files) {
  const lista = [...files].filter((f) => PERMITIDOS.has(base(f.webkitRelativePath || f.name)));
  const nombre = (files[0]?.webkitRelativePath || '').split('/')[0] || undefined;
  return { nombre, archivos: await Promise.all(lista.map(async (f) => ({ nombre: base(f.webkitRelativePath || f.name), contenido: await f.text() }))) };
}

const archivoDe = (entrada) => new Promise((ok, mal) => entrada.file(ok, mal));
const hijosDe = (dir) => new Promise((ok, mal) => dir.createReader().readEntries(ok, mal));

async function desdeEntrada(entrada, acumulado = []) {
  if (entrada.isFile) {
    if (PERMITIDOS.has(entrada.name.toLowerCase())) acumulado.push({ nombre: entrada.name.toLowerCase(), contenido: await (await archivoDe(entrada)).text() });
  } else if (entrada.isDirectory) {
    for (const h of await hijosDe(entrada)) await desdeEntrada(h, acumulado);
  }
  return acumulado;
}

/** Zona «soltar carpeta» + selector de carpeta. La solicitud queda registrada y aparece en la lista. */
export function iniciarCarpeta({ zona, selector, registrar, alRegistrar, alError }) {
  async function enviar(carga) {
    if (!carga.archivos.length) return alError('La carpeta no trae archivos reconocidos (solicitud.json, cotizacion.txt, aprobacion.json, correo.json, factura.txt).');
    zona.classList.add('cargando');
    try {
      alRegistrar(await registrar(carga));
    } catch (e) {
      alError(e.message);
    } finally {
      zona.classList.remove('cargando');
      selector.value = '';
    }
  }

  selector.addEventListener('change', async () => { if (selector.files.length) await enviar(await desdeFiles(selector.files)); });
  zona.addEventListener('click', () => selector.click());
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selector.click(); } });
  for (const ev of ['dragenter', 'dragover']) zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('encima'); });
  for (const ev of ['dragleave', 'drop']) zona.addEventListener(ev, () => zona.classList.remove('encima'));
  zona.addEventListener('drop', async (e) => {
    e.preventDefault();
    const entrada = [...(e.dataTransfer?.items ?? [])].map((i) => i.webkitGetAsEntry?.()).find(Boolean);
    if (!entrada) return alError('Suelta una carpeta (no un archivo suelto).');
    await enviar({ nombre: entrada.isDirectory ? entrada.name : undefined, archivos: await desdeEntrada(entrada) });
  });
}

/** Aviso temporal no bloqueante. */
export function aviso(texto, tipo = 'ok') {
  const t = el('div', `toast ${tipo}`, texto);
  t.setAttribute('role', 'status');
  document.body.append(t);
  setTimeout(() => t.remove(), 6500);
}
