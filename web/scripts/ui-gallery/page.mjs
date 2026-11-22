/*
 * HTML of one gallery page (web, mobile or papier), from the captured views (scripts/ui-gallery.mjs).
 * - Page body only (the artifact host adds the document skeleton): title, scope note, table of contents
 *   by category, one section per view (id, route, width, what it shows, actions, capture at its natural
 *   size, "grille fictive" badge), and a dialog that shows a capture at full resolution.
 */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const META = {
  web: { title: 'Dispatch web', h1: 'Dispatch à l’écran', lead: 'Le jeu à 1280 px, joué à la souris.' },
  mobile: { title: 'Dispatch mobile', h1: 'Dispatch sur téléphone', lead: 'Le jeu à 375 px, joué au toucher, avec trois vues témoins à 320 px.' },
  papier: { title: 'Dispatch papier', h1: 'Dispatch sur papier', lead: 'Les fiches A4 imprimées depuis le jeu (PDF de Chrome, page entière), et l’aperçu d’impression à l’écran.' },
};

const STYLE = `
/* Layout: one reading column for the notes, captures at their natural pixel size in scrollable frames. */
:root {
  --bg: #f3f6f5; --surface: #ffffff; --ink: #1d2826; --soft: #5d6e69; --line: #d5dfdc;
  --accent: #0d6e63; --accent-ink: #ffffff; --fictive: #8a4b00; --fictive-bg: #fdecd3; --frame: #e4ebe9;
  --f-title: "Outfit", "Avenir Next", system-ui, sans-serif;
  --f-ui: "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121816; --surface: #1a2220; --ink: #e3ebe8; --soft: #9aaba6; --line: #2e3a37;
  --accent: #5cc4b5; --accent-ink: #0b1513; --fictive: #ffc27a; --fictive-bg: #3a2810; --frame: #0c1110; color-scheme: dark;
} }
:root[data-theme="dark"] {
  --bg: #121816; --surface: #1a2220; --ink: #e3ebe8; --soft: #9aaba6; --line: #2e3a37;
  --accent: #5cc4b5; --accent-ink: #0b1513; --fictive: #ffc27a; --fictive-bg: #3a2810; --frame: #0c1110; color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--f-ui); font-size: 15px; line-height: 1.5; }
.wrap { max-width: 1360px; margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 32px; }
header { display: grid; gap: 10px; max-width: 70ch; }
.eyebrow { font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--soft); }
h1 { font-family: var(--f-title); font-weight: 300; font-size: clamp(32px, 6vw, 48px); line-height: 1.05; margin: 0; letter-spacing: -.02em; text-wrap: balance; }
h2 { font-family: var(--f-title); font-weight: 400; font-size: 26px; margin: 0; text-wrap: balance; }
p { margin: 0; }
code { font-family: var(--f-mono); font-size: .88em; overflow-wrap: anywhere; }
.note { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; display: grid; gap: 8px; max-width: 80ch; }
.note ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
nav { display: grid; gap: 14px; }
.toc { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px 24px; }
.toc section { display: grid; gap: 6px; align-content: start; min-width: 0; }
.toc h3 { margin: 0; font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--soft); }
.toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.toc a { color: var(--ink); text-decoration: none; display: grid; grid-template-columns: 52px 1fr; gap: 8px; padding: 2px 0; }
.toc a:hover span:last-child, .toc a:focus-visible span:last-child { text-decoration: underline; }
.toc a span:first-child { font-family: var(--f-mono); font-size: 13px; color: var(--accent); font-variant-numeric: tabular-nums; }
.cat { display: grid; gap: 28px; }
.cat > h2 { border-bottom: 1px solid var(--line); padding-bottom: 8px; }
figure { margin: 0; display: grid; gap: 12px; scroll-margin-top: 16px; }
.head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; }
.vid { font-family: var(--f-mono); font-weight: 700; font-size: 18px; color: var(--accent); }
.tag { font-size: 12px; font-weight: 700; border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; color: var(--soft); background: var(--surface); }
.tag.fictive { color: var(--fictive); background: var(--fictive-bg); border-color: transparent; }
.shows { font-size: 16px; max-width: 75ch; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; font-size: 13px; color: var(--soft); max-width: 110ch; }
.facts dt { font-weight: 700; }
.facts dd { margin: 0; min-width: 0; }
.frame { overflow-x: auto; background: var(--frame); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
.frame button { display: block; padding: 0; border: 0; background: none; cursor: zoom-in; }
.frame button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.frame img { display: block; max-width: none; box-shadow: 0 1px 4px rgb(0 0 0 / .18); }
dialog { padding: 0; border: 0; max-width: 100vw; max-height: 100vh; width: 100vw; height: 100vh; background: rgb(10 14 13 / .92); }
dialog .bar { position: sticky; top: 0; display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 10px max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px)); color: #fff; background: rgb(10 14 13 / .9); }
dialog .bar button { font: inherit; font-weight: 700; border: 1px solid #fff6; background: none; color: #fff; border-radius: 6px; padding: 4px 12px; cursor: pointer; }
dialog .zoom { overflow: auto; height: calc(100vh - 52px); padding: 16px; }
dialog .zoom img { max-width: none; display: block; margin: 0 auto; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`;

const SCRIPT = `
const dlg = document.getElementById('zoom');
const img = dlg.querySelector('img');
const cap = dlg.querySelector('[data-cap]');
document.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
  const src = b.querySelector('img');
  img.src = src.src; img.alt = src.alt; img.width = src.naturalWidth; cap.textContent = b.dataset.zoom;
  dlg.showModal();
}));
dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
`;

function figure(v) {
  const w = Math.round(v.size.w / 2);
  const h = Math.round(v.size.h / 2);
  const width = v.width === 'A4' ? 'A4 (PDF, 192 dpi)' : `${v.width} px`;
  const tags = [`<span class="tag">${esc(width)}</span>`];
  if (v.fictive) tags.push('<span class="tag fictive">grille fictive</span>');
  return `<figure id="${v.id}">
  <div class="head"><span class="vid">${v.id}</span>${tags.join('')}</div>
  <p class="shows">${esc(v.shows)}</p>
  <dl class="facts"><dt>Route</dt><dd><code>${esc(v.route)}</code></dd>${v.gridTitle ? `<dt>Grille</dt><dd>${esc(v.gridTitle)}</dd>` : ''}<dt>Actions</dt><dd>${esc(v.actionsText)}</dd></dl>
  <div class="frame"><button type="button" data-zoom="${esc(`${v.id} · ${v.shows}`)}" aria-label="Agrandir ${v.id}"><img src="${v.img}" width="${w}" height="${h}" alt="${esc(`${v.id} : ${v.shows}`)}" loading="lazy"></button></div>
</figure>`;
}

export function renderPage(kind, views) {
  const m = META[kind];
  const cats = [];
  for (const v of views) {
    let c = cats.find((x) => x.name === v.cat);
    if (!c) cats.push((c = { name: v.cat, views: [] }));
    c.views.push(v);
  }
  const slug = (s) => `cat-${s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  const toc = cats.map((c) => `<section><h3><a href="#${slug(c.name)}" style="display:inline;color:inherit">${esc(c.name)}</a></h3><ol>${c.views.map((v) => `<li><a href="#${v.id}"><span>${v.id}</span><span>${esc(v.shows.split(/ : |[;(,.]/)[0].trim())}</span></a></li>`).join('')}</ol></section>`).join('');
  const fictive = views.filter((v) => v.fictive).length;
  return `<title>${m.title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400&family=Manrope:wght@400;700;800&display=swap">
<style>${STYLE}</style>
<div class="wrap">
<header>
  <span class="eyebrow">Galerie UI · ${views.length} vues</span>
  <h1>${esc(m.h1)}</h1>
  <p>${esc(m.lead)} Chaque image est une capture du vrai jeu, rejouée par <code>web/scripts/ui-gallery.mjs</code> ; aucune n’est retouchée. Cliquer une capture l’agrandit en pleine résolution.</p>
</header>
<aside class="note" aria-label="Périmètre">
  <b>Hors périmètre</b>
  <ul>
    <li>Animations et gestes : seul l’état figé d’un geste est capturé (glisser maintenu, premier toucher).</li>
    <li>Le lab, la tablette et le mode sombre ne sont pas montrés.</li>
    <li>${fictive} vue${fictive > 1 ? 's portent' : ' porte'} le badge « grille fictive » : grille écrite pour la galerie (ids 901+), jamais publiée. Le verdict juste n’est montré que sur de vraies grilles.</li>
    <li>Date du jeu figée après le dernier bulletin : la fiche du jour est le dernier bulletin publié.</li>
  </ul>
</aside>
<nav aria-label="Sommaire"><span class="eyebrow">Sommaire</span><div class="toc">${toc}</div></nav>
${cats.map((c) => `<section class="cat" id="${slug(c.name)}"><h2>${esc(c.name)}</h2>${c.views.map(figure).join('\n')}</section>`).join('\n')}
</div>
<dialog id="zoom" aria-label="Capture agrandie"><div class="bar"><span data-cap></span><button type="button" data-close>Fermer</button></div><div class="zoom"><img alt=""></div></dialog>
<script>${SCRIPT}</script>
`;
}
