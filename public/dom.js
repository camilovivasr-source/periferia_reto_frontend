/** Crea un elemento con clase y texto (siempre como texto: nada del modelo se interpreta como HTML). */
export function el(tag, clase, contenido) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (contenido !== undefined) e.textContent = contenido;
  return e;
}
