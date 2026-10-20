// Renderizador minimo y seguro de Markdown: construye nodos DOM (nunca innerHTML con texto del modelo).
const elemento = (doc, tag, texto, clase) => {
  const el = doc.createElement(tag);
  if (texto !== undefined) el.textContent = texto;
  if (clase) el.className = clase;
  return el;
};

function inline(doc, padre, texto) {
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) padre.append(texto.slice(ultimo, m.index));
    const t = m[0];
    if (t.startsWith('**')) padre.append(elemento(doc, 'strong', t.slice(2, -2)));
    else if (t.startsWith('`')) padre.append(elemento(doc, 'code', t.slice(1, -1)));
    else padre.append(elemento(doc, 'em', t.slice(1, -1)));
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) padre.append(texto.slice(ultimo));
}

const celdas = (linea) => linea.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const esSeparador = (linea) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(linea);

export function renderMarkdown(doc, texto) {
  const raiz = doc.createDocumentFragment();
  const lineas = String(texto ?? '').replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    if (l.includes('|') && i + 1 < lineas.length && esSeparador(lineas[i + 1])) {
      const tabla = elemento(doc, 'table');
      const cab = elemento(doc, 'tr');
      for (const c of celdas(l)) { const th = elemento(doc, 'th'); inline(doc, th, c); cab.append(th); }
      tabla.append(cab);
      i += 2;
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim()) {
        const tr = elemento(doc, 'tr');
        for (const c of celdas(lineas[i])) { const td = elemento(doc, 'td'); inline(doc, td, c); tr.append(td); }
        tabla.append(tr);
        i++;
      }
      const caja = elemento(doc, 'div', undefined, 'tabla');
      caja.append(tabla);
      raiz.append(caja);
      continue;
    }
    const titulo = /^(#{1,4})\s+(.*)$/.exec(l);
    if (titulo) { const h = elemento(doc, 'h4'); inline(doc, h, titulo[2]); raiz.append(h); i++; continue; }
    if (/^\s*([-*•]|\d+\.)\s+/.test(l)) {
      const ordenada = /^\s*\d+\./.test(l);
      const lista = elemento(doc, ordenada ? 'ol' : 'ul');
      while (i < lineas.length && /^\s*([-*•]|\d+\.)\s+/.test(lineas[i])) {
        const li = elemento(doc, 'li');
        inline(doc, li, lineas[i].replace(/^\s*([-*•]|\d+\.)\s+/, ''));
        lista.append(li);
        i++;
      }
      raiz.append(lista);
      continue;
    }
    const p = elemento(doc, 'p');
    const bloque = [];
    while (i < lineas.length && lineas[i].trim() && !/^\s*([-*•]|\d+\.)\s+/.test(lineas[i]) && !/^#{1,4}\s/.test(lineas[i]) && !(lineas[i].includes('|') && i + 1 < lineas.length && esSeparador(lineas[i + 1]))) bloque.push(lineas[i++]);
    bloque.forEach((b, k) => { if (k) p.append(doc.createElement('br')); inline(doc, p, b); });
    raiz.append(p);
  }
  return raiz;
}
