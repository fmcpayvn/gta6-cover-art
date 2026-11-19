// Fixed scenes for screenshots: ?shot=editor shows the studio with a sample
// photo loaded; ?shot=cover shows only the exported cover, at the ratio the
// `ratio` query picks (wide, square or portrait); ?shot=selftest renders all
// three export sizes off screen and reports their sizes into #test.
// window.__shotReady is set once the scene has painted.
import { SIZES } from './cover.js';

const RATIOS = {
  wide: [1920, 1080],
  square: [1080, 1080],
  portrait: [1080, 1350],
};

function applyQuery(state, query) {
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('caption')) state.caption = query.get('caption');
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('title') === '0') state.titleBlock = false;
  if (query.get('badge') === '0') state.badge = false;
  if (query.get('grain') === '0') state.grain = false;
  if (query.get('vignette') === '0') state.vignette = false;
}

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

export async function runShot(shot, query, api) {
  const { state, photos, renderCover } = api;
  applyQuery(state, query);
  const canvas = document.getElementById('cover');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const [w, h] = RATIOS[query.get('ratio') || 'wide'] || RATIOS.wide;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.objectFit = 'contain';
    document.body.style.background = '#0b0618';
    await document.fonts.ready;
    renderCover(canvas, state, photos);
    markReady();
    return;
  }
  if (shot === 'selftest') {
    document.body.classList.add('shot-cover');
    const off = document.createElement('canvas');
    const lines = [];
    for (const size of SIZES) {
      off.width = size.w;
      off.height = size.h;
      renderCover(off, state, photos);
      const px = off.getContext('2d').getImageData(Math.floor(size.w / 2), Math.floor(size.h / 2), 1, 1).data;
      lines.push(`${size.w}x${size.h} center=${px[0]},${px[1]},${px[2]}`);
    }
    const el = document.getElementById('test');
    if (el) el.textContent = lines.join(' | ');
    document.title = lines.join(' | ');
    markReady();
    return;
  }
  // editor (and any other value): the full studio, photo loaded.
  api.syncControls();
  markReady();
}
