const CLAVE = 'sessionId';

const generar = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random().toString(16).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');

/** Identificador de sesion del chat; sobrevive a recargas de la pestana (sessionStorage, si esta disponible). */
export function crearSesion() {
  let id = null;
  try { id = sessionStorage.getItem(CLAVE); } catch { /* almacenamiento bloqueado */ }
  const previa = !!id && id.length >= 8;
  const nueva = () => {
    id = generar();
    try { sessionStorage.setItem(CLAVE, id); } catch { /* ignorar */ }
    return id;
  };
  if (!previa) nueva();
  return { get id() { return id; }, previa, nueva };
}
