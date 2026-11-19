// Robo Vice Cover Studio — wires the page: pick photos, choose a layout and a
// grade, letter the caption, drag each panel's photo into place, undo and
// redo, and export all three post sizes as PNGs in one step. Photos are read
// on this machine and never uploaded anywhere.
import { LAYOUTS, GRADES, SIZES, layoutRects, renderCover } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { key: 'robo-boulevard', label: 'Robot on the boulevard', url: 'samples/robo-boulevard.jpg' },
  { key: 'robo-rooftop', label: 'Robot on the rooftop', url: 'samples/robo-rooftop.jpg' },
  { key: 'robo-neon', label: 'Robots on neon street', url: 'samples/robo-neon.jpg' },
];

const DEFAULT_PANELS = [
  { photo: 'robo-boulevard', zoom: 1.15, x: 0.5, y: 0.45 },
  { photo: 'robo-rooftop', zoom: 1.15, x: 0.5, y: 0.5 },
  { photo: 'robo-neon', zoom: 1.15, x: 0.5, y: 0.5 },
  { photo: 'robo-boulevard', zoom: 1.3, x: 0.62, y: 0.4 },
  { photo: 'robo-rooftop', zoom: 1.2, x: 0.4, y: 0.55 },
  { photo: 'robo-neon', zoom: 1.2, x: 0.55, y: 0.45 },
  { photo: 'robo-boulevard', zoom: 1.25, x: 0.45, y: 0.5 },
  { photo: 'robo-rooftop', zoom: 1.25, x: 0.55, y: 0.45 },
  { photo: 'robo-neon', zoom: 1.25, x: 0.5, y: 0.55 },
];

function defaultState() {
  return {
    layout: 'grid4',
    grade: 'vice',
    caption: 'ROBO VICE',
    subtitle: 'steel city nights',
    titleBlock: true,
    badge: true,
    grain: true,
    vignette: true,
    selected: 0,
    panels: DEFAULT_PANELS.map((p) => ({ ...p })),
  };
}

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const photos = new Map(); // key -> HTMLImageElement
const photoOptions = [...SAMPLES]; // {key, label}
let state = defaultState();
let history = [];
let future = [];
let lastRects = [];
let drag = null;

export function loadImage(url, key) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { img.dataset.key = key; resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    if (!photos.has(s.key)) photos.set(s.key, await loadImage(s.url, s.key));
  }
}

function snapshot() {
  return JSON.stringify(state);
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  updateUndoButtons();
}

function restore(json) {
  state = JSON.parse(json);
  syncControls();
  redraw();
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
  updateUndoButtons();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
  updateUndoButtons();
}

function updateUndoButtons() {
  $('undo').disabled = history.length === 0;
  $('redo').disabled = future.length === 0;
}

function redraw() {
  lastRects = renderCover(canvas, state, photos);
}

function fitPreviewCanvas() {
  const ratio = state.layout === 'fullbleed' ? 16 / 9 : 1;
  const box = $('previewBox');
  const availW = Math.min(box.clientWidth, 720);
  const availH = Math.min(box.clientHeight, 720);
  let w = availW;
  let h = w / ratio;
  if (h > availH) { h = availH; w = h * ratio; }
  canvas.width = Math.round(w * 2);
  canvas.height = Math.round(h * 2);
  canvas.style.width = `${Math.round(w)}px`;
  canvas.style.height = `${Math.round(h)}px`;
  redraw();
}

function buildLayoutButtons() {
  const wrap = $('layouts');
  wrap.innerHTML = '';
  for (const [id, meta] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = meta.label;
    b.setAttribute('aria-pressed', String(state.layout === id));
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = id;
      state.selected = 0;
      buildLayoutButtons();
      syncPanelEditor();
      fitPreviewCanvas();
    });
    wrap.appendChild(b);
  }
}

function buildGradeButtons() {
  const wrap = $('grades');
  wrap.innerHTML = '';
  for (const [id, meta] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip swatch';
    b.style.setProperty('--g1', meta.stops[0]);
    b.style.setProperty('--g2', meta.stops[1]);
    b.style.setProperty('--g3', meta.stops[2]);
    b.textContent = meta.label;
    b.setAttribute('aria-pressed', String(state.grade === id));
    b.addEventListener('click', () => {
      pushHistory();
      state.grade = id;
      buildGradeButtons();
      redraw();
    });
    wrap.appendChild(b);
  }
}

function panelCount() {
  return LAYOUTS[state.layout].panels;
}

function syncPanelEditor() {
  const sel = $('panelPhoto');
  sel.innerHTML = '';
  for (const opt of photoOptions) {
    const o = document.createElement('option');
    o.value = opt.key;
    o.textContent = opt.label;
    sel.appendChild(o);
  }
  const panel = state.panels[state.selected];
  sel.value = panel.photo;
  $('panelZoom').value = panel.zoom;
  $('panelX').value = panel.x * 100;
  $('panelY').value = panel.y * 100;
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${panelCount()}`;
  document.querySelectorAll('#panelDots button').forEach((b, i) => {
    b.classList.toggle('on', i === state.selected);
    b.style.display = i < panelCount() ? '' : 'none';
  });
}

function buildPanelDots() {
  const wrap = $('panelDots');
  wrap.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(i + 1);
    b.addEventListener('click', () => {
      state.selected = i;
      syncPanelEditor();
      redraw();
    });
    wrap.appendChild(b);
  }
}

function syncControls() {
  $('caption').value = state.caption;
  $('subtitle').value = state.subtitle;
  $('titleBlock').checked = state.titleBlock;
  $('badge').checked = state.badge;
  $('grain').checked = state.grain;
  $('vignette').checked = state.vignette;
  buildLayoutButtons();
  buildGradeButtons();
  syncPanelEditor();
  fitPreviewCanvas();
}

function bindControls() {
  $('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
  $('caption').addEventListener('change', pushHistory);
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('subtitle').addEventListener('change', pushHistory);
  for (const id of ['titleBlock', 'badge', 'grain', 'vignette']) {
    $(id).addEventListener('change', (e) => {
      pushHistory();
      state[id] = e.target.checked;
      redraw();
    });
  }
  $('panelPhoto').addEventListener('change', (e) => {
    pushHistory();
    state.panels[state.selected].photo = e.target.value;
    redraw();
  });
  $('panelZoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    redraw();
  });
  $('panelZoom').addEventListener('change', pushHistory);
  $('panelX').addEventListener('input', (e) => {
    state.panels[state.selected].x = Number(e.target.value) / 100;
    redraw();
  });
  $('panelX').addEventListener('change', pushHistory);
  $('panelY').addEventListener('input', (e) => {
    state.panels[state.selected].y = Number(e.target.value) / 100;
    redraw();
  });
  $('panelY').addEventListener('change', pushHistory);
  $('shuffle').addEventListener('click', () => {
    pushHistory();
    const keys = photoOptions.map((o) => o.key);
    for (let i = 0; i < panelCount(); i++) {
      state.panels[i].photo = keys[(i + Math.floor(Math.random() * keys.length)) % keys.length];
    }
    syncPanelEditor();
    redraw();
  });
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });
  $('upload').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const file of files) {
      const key = `up-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const url = URL.createObjectURL(file);
      const img = await loadImage(url, key);
      photos.set(key, img);
      photoOptions.push({ key, label: `Your photo: ${file.name}` });
    }
    if (files.length) {
      pushHistory();
      state.panels[state.selected].photo = photoOptions[photoOptions.length - 1].key;
      syncPanelEditor();
      redraw();
      $('status').textContent = `${files.length} photo${files.length > 1 ? 's' : ''} loaded — kept on this machine.`;
    }
    e.target.value = '';
  });
  $('exportAll').addEventListener('click', exportAll);
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width * canvas.width,
    y: (e.clientY - r.top) / r.height * canvas.height,
  };
}

function hitPanel(p) {
  for (let i = lastRects.length - 1; i >= 0; i--) {
    const r = lastRects[i];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
  }
  return -1;
}

function bindCanvas() {
  canvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(e);
    const i = hitPanel(p);
    if (i < 0) return;
    state.selected = i;
    syncPanelEditor();
    const panel = state.panels[i];
    drag = { panel, startX: p.x, startY: p.y, x0: panel.x, y0: panel.y, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = canvasPoint(e);
    const rect = lastRects[state.selected];
    if (!rect) return;
    const dx = (p.x - drag.startX) / rect.w;
    const dy = (p.y - drag.startY) / rect.h;
    if (Math.abs(dx) + Math.abs(dy) > 0.005) drag.moved = true;
    drag.panel.x = Math.min(1, Math.max(0, drag.x0 - dx));
    drag.panel.y = Math.min(1, Math.max(0, drag.y0 - dy));
    $('panelX').value = drag.panel.x * 100;
    $('panelY').value = drag.panel.y * 100;
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && drag.moved) pushHistory();
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[state.selected];
    panel.zoom = Math.min(3, Math.max(1, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    $('panelZoom').value = panel.zoom;
    redraw();
  }, { passive: false });
}

function download(canvasEl, filename) {
  return new Promise((resolve) => {
    canvasEl.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

async function exportAll() {
  const btn = $('exportAll');
  btn.disabled = true;
  $('status').textContent = 'Exporting 3 PNGs…';
  const off = document.createElement('canvas');
  for (const size of SIZES) {
    off.width = size.w;
    off.height = size.h;
    renderCover(off, state, photos);
    // Let the browser keep up between downloads.
    await new Promise((r) => setTimeout(r, 120));
    await download(off, size.file);
  }
  $('status').textContent = 'Saved 3 PNGs: 1080 x 1080, 1080 x 1350, 1920 x 1080.';
  btn.disabled = false;
}

async function boot() {
  await document.fonts.ready;
  await loadSamples();
  buildPanelDots();
  bindControls();
  bindCanvas();
  syncControls();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    await runShot(shot, params, { state, photos, renderCover, syncControls, redraw });
  }
  window.addEventListener('resize', fitPreviewCanvas);
}

boot().catch((err) => {
  $('status').textContent = `Could not start: ${err.message}`;
});
