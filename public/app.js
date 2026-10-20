import { consultarCasos, consultarHistorial, consultarOpciones, consultarSalud, enviarTurno, registrarSolicitud } from './api.js';
import { crearDialogoSolicitud } from './nueva-solicitud.js';
import { ocultarAvisos, pintarConfirmacion, pintarSugerencias } from './avisos.js';
import { el } from './dom.js';
import { iniciarAnalisis } from './analisis/index.js';
import { crearSesion } from './sesion.js';
import { pintarCasos } from './vista-casos.js';
import { MensajeAgente, agregarUsuario, bajar, limpiarChat } from './vista-chat.js';

const $ = (id) => document.getElementById(id);
const formulario = $('form'), texto = $('texto'), boton = $('enviar');
const sesion = crearSesion();

const PROCESAR = (c) => `Procesa la solicitud "${c}". Muéstrame la OC como quedaría en SAP, qué validaciones pasó y cuáles no, y no la crees hasta que yo lo confirme.`;
const EJEMPLOS = [
  ['Procesar sol-001', 'Caso limpio: se crea sin intervención', 'Procesa la solicitud "sol-001" y créala si cumple todo.'],
  ['Procesar sol-004', 'La cotización difiere: pide confirmación', PROCESAR('sol-004')],
  ['Procesar sol-003', 'Aprobador sin autoridad: se bloquea', 'Procesa la solicitud "sol-003" y explícame qué debo hacer.'],
  ['¿Cuántas OC son retroactivas?', 'Resumen del registro de control', 'Muéstrame el resumen del control y cuántas OC son retroactivas.'],
];

async function refrescarCasos() {
  try {
    pintarCasos(await consultarCasos(), (c) => mandar(c.estado === 'CREADA' ? `Muéstrame el estado de ${c.caso}: ya tiene OC, ¿cuál es el número y su evidencia?` : PROCESAR(c.caso)));
  } catch { /* la barra lateral es informativa */ }
}

async function mandar(mensaje) {
  const t = mensaje.trim();
  if (!t || boton.disabled) return;
  agregarUsuario(t);
  texto.value = '';
  autoajustar();
  boton.disabled = true;
  ocultarAvisos();
  const agente = new MensajeAgente();
  agente.pensando();
  bajar();
  try {
    const final = await enviarTurno(sesion.id, t, (ev) => {
      if (ev.tipo === 'tool_start') agente.llamada({ id: ev.id, nombre: ev.nombre, args: ev.args }, true);
      if (ev.tipo === 'tool_end') agente.llamada(ev.llamada);
      bajar();
    });
    agente.texto(final.reply);
    pintarConfirmacion(final.pendientes, mandar);
    pintarSugerencias(final.sugerencias, final.needsConfirmation, mandar);
  } catch (e) {
    agente.error(e.message);
  } finally {
    boton.disabled = false;
    texto.focus();
    bajar();
    refrescarCasos();
  }
}

async function restaurarHistorial() {
  try {
    for (const h of await consultarHistorial(sesion.id)) {
      if (h.rol === 'user') { agregarUsuario(h.contenido); continue; }
      const agente = new MensajeAgente();
      for (const l of h.toolCalls ?? []) agente.llamada(l);
      agente.texto(h.contenido);
    }
    bajar();
  } catch { /* sin historial */ }
}

function autoajustar() {
  texto.style.height = 'auto';
  texto.style.height = `${Math.min(texto.scrollHeight, 160)}px`;
}

async function iniciar() {
  for (const [titulo, detalle, mensaje] of EJEMPLOS) {
    const b = el('button', 'ejemplo', titulo);
    b.type = 'button';
    b.append(el('small', undefined, detalle));
    b.addEventListener('click', () => mandar(mensaje));
    $('ejemplos').append(b);
  }
  try {
    const salud = await consultarSalud();
    const chip = $('modo');
    const llm = salud.modo === 'LLM';
    chip.textContent = llm ? `${salud.modelo} · ${salud.proveedor === 'google-vertex-ai' ? 'Vertex AI' : 'Gemini'}` : 'modo práctica (sin LLM)';
    chip.className = `chip ${llm ? 'llm' : 'practica'}`;
  } catch { $('modo').textContent = 'backend sin respuesta'; }
  refrescarCasos();
  if (sesion.previa) await restaurarHistorial();
}

formulario.addEventListener('submit', (e) => { e.preventDefault(); mandar(texto.value); });
texto.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); mandar(texto.value); } });
texto.addEventListener('input', autoajustar);
$('nueva').addEventListener('click', () => { sesion.nueva(); limpiarChat(); ocultarAvisos(); texto.focus(); });

// ── pestanas: Asistente / Analisis ──
const analisis = iniciarAnalisis();
function mostrarPestana(nombre) {
  const esAnalisis = nombre === 'analisis';
  $('vista-asistente').hidden = esAnalisis;
  $('vista-analisis').hidden = !esAnalisis;
  $('tab-asistente').setAttribute('aria-selected', String(!esAnalisis));
  $('tab-analisis').setAttribute('aria-selected', String(esAnalisis));
  if (esAnalisis) analisis.abrir();
  else refrescarCasos();
}
// ── nueva solicitud ──
const dialogoSolicitud = crearDialogoSolicitud({
  cargarOpciones: consultarOpciones,
  registrar: registrarSolicitud,
  alRegistrar: (r) => {
    mostrarPestana('asistente');
    mandar(`Registré la solicitud ${r.caso} (${r.solicitud_id}). Procésala: muéstrame la OC como quedaría en SAP y qué controles pasó, y no la crees hasta que yo lo confirme.`);
  },
});
$('nueva-solicitud').addEventListener('click', () => dialogoSolicitud.abrir());
$('tab-asistente').addEventListener('click', () => mostrarPestana('asistente'));
$('tab-analisis').addEventListener('click', () => mostrarPestana('analisis'));
iniciar();
