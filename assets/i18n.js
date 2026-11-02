/* homer0.es · idiomas
   Español por defecto. Inglés con ?lang=en o si se eligió con el botón ES · EN (se recuerda en este navegador).
   - t('texto') y tf('Paso {a} de {b}', { a, b }) traducen las cadenas que monta el código;
   - el HTML fijo se traduce al arrancar y lo que se pinta después lo traduce un observador, unidad a unidad:
     un texto, un atributo (aria-label, title, alt…) o, si una frase lleva negritas o enlaces dentro, el bloque entero;
   - las traducciones viven en assets/en.js: window.EN = { t: { 'texto': 'text' }, dom: { 'unidad': 'unit' } };
   - el botón recarga la página en el otro idioma sin la intro y en el mismo punto del scroll.
   Con ?lang=en&recolectar se apuntan todas las claves que se usan en window.__h0claves (para ampliar en.js). */
(function () {
  const q = new URLSearchParams(location.search);
  let lang = 'es';
  try {
    const p = q.get('lang');
    if (p === 'en' || p === 'es') { lang = p; localStorage.setItem('h0-lang', p); }
    else if (localStorage.getItem('h0-lang') === 'en') lang = 'en';
  } catch (e) { /* sin almacenamiento: manda la URL */ }
  const EN = lang === 'en';
  const RECO = q.has('recolectar');
  window.LANG = lang;
  document.documentElement.lang = lang;

  const claves = window.__h0claves = { t: new Set(), dom: new Set() };
  const dic = k => (window.EN && window.EN[k]) || {};
  const norm = s => s.replace(/[\s ]+/g, ' ').trim();

  function t(s) {
    if (RECO) claves.t.add(s);
    if (!EN) return s;
    const v = dic('t')[s];
    return v == null ? s : v;
  }
  const tf = (s, v) => t(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

  /* ---- unidades de traducción ---- */
  const INLINE = /^(B|I|EM|STRONG|SPAN|A|BR|SMALL|SUP|SUB|U|S|MARK|ABBR|WBR)$/;
  const SALTA = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|CANVAS|TEXTAREA|INPUT|SELECT|VIDEO|AUDIO)$/i;
  const ATTRS = ['aria-label', 'title', 'alt', 'placeholder', 'data-ticker'];
  // un bloque con formato dentro se traduce entero solo si nada de dentro tiene id ni datos que el código use
  const limpio = el => [...el.querySelectorAll('*')].every(c => INLINE.test(c.tagName) && [...c.attributes].every(a => /^(class|href|target|rel|lang|style)$/.test(a.name)));
  function unidades(root, out) {
    out = out || [];
    if (!root || root.nodeType !== 1) return out;
    if (root.getAttribute('translate') === 'no') return out;
    for (const a of ATTRS) { const v = root.getAttribute(a); if (v && norm(v)) out.push({ el: root, a, k: norm(v) }); }
    if (SALTA.test(root.tagName) || root.tagName.toLowerCase() === 'svg') return out;
    const conTexto = [...root.childNodes].some(n => n.nodeType === 3 && norm(n.data));
    if (conTexto && root.firstElementChild && limpio(root)) { out.push({ el: root, html: 1, k: norm(root.innerHTML) }); return out; }
    for (const n of root.childNodes) {
      if (n.nodeType === 3) { if (norm(n.data)) out.push({ n, k: norm(n.data) }); }
      else unidades(n, out);
    }
    return out;
  }
  function aplicar(us) {
    const d = dic('dom'), dt = dic('t');
    for (const u of us) {
      if (RECO) claves.dom.add(u.k);
      // lo que la página trae escrito de serie y el código luego actualiza con t() (p. ej. «Cromo» en el HUD) vale de las dos listas
      const v = d[u.k] != null ? d[u.k] : dt[u.k];
      if (v == null || v === u.k) continue;
      if (u.a) u.el.setAttribute(u.a, v);
      else if (u.html) u.el.innerHTML = v;
      else { const m = /^(\s*)[\s\S]*?(\s*)$/.exec(u.n.data); u.n.data = m[1] + v + m[2]; }
    }
  }
  // nada dentro de un script, de un SVG o de lo marcado translate="no" (las webs de clientes se quedan en su idioma)
  const fuera = el => !!(el && el.closest && el.closest('[translate="no"], script, style, noscript, template, svg'));
  function traducir(root) {
    if (!EN && !RECO) return;
    if (root !== document.body && fuera(root.parentElement)) return;
    aplicar(unidades(root));
  }
  function traducirTexto(n) { const p = n.parentElement; if (p && !fuera(p) && !SALTA.test(p.tagName) && norm(n.data)) aplicar([{ n, k: norm(n.data) }]); }
  // una plantilla HTML (cadena) traducida antes de pintarla: para lo que el código anima nada más insertarlo
  function trHTML(html) {
    if (!EN && !RECO) return html;
    const tp = document.createElement('template');
    tp.innerHTML = html;
    for (const n of [...tp.content.childNodes]) { if (n.nodeType === 1) traducir(n); else if (n.nodeType === 3) traducirTexto(n); }
    return tp.innerHTML;
  }
  // un objeto de datos (FLOWS, STATES…): todas sus cadenas pasan por t() salvo las claves técnicas
  function trObj(o, salta) {
    if (Array.isArray(o)) return o.map(x => trObj(x, salta));
    if (typeof o === 'string') return t(o);
    if (o && typeof o === 'object') { for (const k in o) if (!salta.includes(k)) o[k] = trObj(o[k], salta); }
    return o;
  }

  /* ---- arranque: el HTML fijo antes de que lo lea la web; después, un observador ---- */
  function arrancar() {
    if (!EN && !RECO) return;
    traducir(document.body);
    const obs = new MutationObserver(recs => {
      for (const r of recs) {
        if (r.type === 'childList') r.addedNodes.forEach(n => { if (n.nodeType === 1) traducir(n); else if (n.nodeType === 3) traducirTexto(n); });
        else if (r.type === 'attributes' && r.target.getAttribute(r.attributeName) && !fuera(r.target)) {
          const v = r.target.getAttribute(r.attributeName);
          aplicar([{ el: r.target, a: r.attributeName, k: norm(v) }]);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  }

  /* ---- el botón ---- */
  function cambiar() {
    const otro = EN ? 'es' : 'en';
    // se guarda la sección que está a la vista y cuánto se ha bajado dentro de ella: el otro idioma puede medir distinto
    const sec = [...document.querySelectorAll('main > section[id]')].filter(s => s.getBoundingClientRect().top <= innerHeight * 0.5).pop();
    try {
      localStorage.setItem('h0-lang', otro);
      sessionStorage.setItem('h0-salto', JSON.stringify({ y: Math.round(scrollY), id: sec ? sec.id : '', off: sec ? Math.round(-sec.getBoundingClientRect().top) : 0 }));
    } catch (e) { /* sin almacenamiento: al menos cambia por la URL */ }
    const u = new URL(location.href);
    if (otro === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.delete('lang');
    location.replace(u.href);
  }
  // tras cambiar de idioma: sin intro y en el mismo sitio (lo lee la web al arrancar)
  function salto() {
    try { const s = sessionStorage.getItem('h0-salto'); sessionStorage.removeItem('h0-salto'); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }

  window.H0I18N = { lang, EN, t, tf, trHTML, trObj, traducir, arrancar, cambiar, salto, unidades, norm };
})();
