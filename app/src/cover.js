// Robo Vice — the cover engine. Draws a multi-panel GTA-style poster cover
// (robot / chrome-mecha theme, Vice City neon sunset) onto a 2D canvas.
// Everything is drawn from local photos and vendored fonts: no network, no
// Rockstar artwork, no Rockstar fonts. Anton does the bold title lettering,
// Pacifico does the neon script subtitle.

export const LAYOUTS = {
  grid4: { label: 'Four-panel grid', panels: 4 },
  hero3: { label: 'Hero and three', panels: 4 },
  fullbleed: { label: 'Full bleed', panels: 1 },
  tilted: { label: 'Tilted snapshots', panels: 3 },
  nine: { label: 'Nine-panel grid', panels: 9 },
};

export const GRADES = {
  vice: { label: 'Vice Sunset', stops: ['#160a2e', '#ff5e78', '#ffd166'], mix: 0.55 },
  neon: { label: 'Neon Pink', stops: ['#04081f', '#ff2e88', '#2ee6ff'], mix: 0.6 },
  chrome: { label: 'Chrome Steel', stops: ['#0b0f16', '#8fa3b8', '#f4f8ff'], mix: 0.5 },
  midnight: { label: 'Midnight Purple', stops: ['#06021a', '#7b2ff7', '#ff9de2'], mix: 0.6 },
  gold: { label: 'Gold Hour', stops: ['#1c0f00', '#ff9a3c', '#fff3b0'], mix: 0.5 },
  mono: { label: 'Chrome Mono', stops: ['#000000', '#8a8a8a', '#ffffff'], mix: 0.75 },
};

export const SIZES = [
  { label: 'Square 1080 x 1080', w: 1080, h: 1080, file: 'robo-vice-1080x1080.png' },
  { label: 'Portrait 1080 x 1350', w: 1080, h: 1350, file: 'robo-vice-1080x1350.png' },
  { label: 'Wide 1920 x 1080', w: 1920, h: 1080, file: 'robo-vice-1920x1080.png' },
];

const TITLE_FONT = 'Anton, "Arial Black", sans-serif';
const SCRIPT_FONT = 'Pacifico, cursive';

/** Panel rectangles (fractions of the canvas) for a layout. Title band sits below. */
export function layoutRects(layout, W, H) {
  const band = layout === 'fullbleed' ? 0.24 : layout === 'nine' ? 0.16 : 0.22;
  const top = 0;
  const bottom = H * (1 - band);
  const g = Math.round(W * 0.012); // gutter
  const area = { x: g, y: g, w: W - 2 * g, h: bottom - top - g };
  const r = (x, y, w, h, rot = 0) => ({ x, y, w, h, rot });
  switch (layout) {
    case 'grid4': {
      const cw = (area.w - g) / 2;
      const ch = (area.h - g) / 2;
      return [
        r(area.x, area.y, cw, ch),
        r(area.x + cw + g, area.y, cw, ch),
        r(area.x, area.y + ch + g, cw, ch),
        r(area.x + cw + g, area.y + ch + g, cw, ch),
      ];
    }
    case 'hero3': {
      const heroW = area.w * 0.6;
      const sideX = area.x + heroW + g;
      const sideW = area.w - heroW - g;
      const sh = (area.h - 2 * g) / 3;
      return [
        r(area.x, area.y, heroW, area.h),
        r(sideX, area.y, sideW, sh),
        r(sideX, area.y + sh + g, sideW, sh),
        r(sideX, area.y + 2 * (sh + g), sideW, sh),
      ];
    }
    case 'fullbleed':
      return [r(0, 0, W, H)];
    case 'tilted': {
      const pw = area.w * 0.42;
      const ph = area.h * 0.78;
      const cy = area.y + (area.h - ph) / 2;
      return [
        r(area.x + area.w * 0.02, cy, pw, ph, -0.07),
        r(area.x + (area.w - pw) / 2, cy - area.h * 0.02, pw, ph, 0.02),
        r(area.x + area.w * 0.56, cy, pw, ph, 0.07),
      ];
    }
    case 'nine': {
      const cw = (area.w - 2 * g) / 3;
      const ch = (area.h - 2 * g) / 3;
      const out = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          out.push(r(area.x + col * (cw + g), area.y + row * (ch + g), cw, ch));
        }
      }
      return out;
    }
    default:
      return [r(area.x, area.y, area.w, area.h)];
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function gradeRamp(stops) {
  const ramp = new Uint8Array(256 * 3);
  const c0 = hexToRgb(stops[0]);
  const c1 = hexToRgb(stops[1]);
  const c2 = hexToRgb(stops[2]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a, b, f;
    if (t < 0.5) { a = c0; b = c1; f = t / 0.5; } else { a = c1; b = c2; f = (t - 0.5) / 0.5; }
    ramp[i * 3] = a[0] + (b[0] - a[0]) * f;
    ramp[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
    ramp[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
  }
  return ramp;
}

const gradeCache = new Map();

/** Returns a canvas holding `img` recoloured by the grade's gradient map. */
export function gradedPhoto(img, gradeId) {
  const key = `${img.dataset.key || img.src}|${gradeId}`;
  if (gradeCache.has(key)) return gradeCache.get(key);
  const grade = GRADES[gradeId] || GRADES.vice;
  const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * scale));
  const h = Math.max(2, Math.round(img.naturalHeight * scale));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const ramp = gradeRamp(grade.stops);
  const mix = grade.mix;
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
    const j = lum * 3;
    px[i] = px[i] * (1 - mix) + ramp[j] * mix;
    px[i + 1] = px[i + 1] * (1 - mix) + ramp[j + 1] * mix;
    px[i + 2] = px[i + 2] * (1 - mix) + ramp[j + 2] * mix;
  }
  ctx.putImageData(data, 0, 0);
  gradeCache.set(key, cv);
  return cv;
}

let grainPattern = null;
function getGrain(ctx) {
  if (grainPattern) return grainPattern;
  const n = document.createElement('canvas');
  n.width = 180;
  n.height = 180;
  const c = n.getContext('2d');
  const d = c.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  c.putImageData(d, 0, 0);
  grainPattern = ctx.createPattern(n, 'repeat');
  return grainPattern;
}

function drawPanelPhoto(ctx, img, rect, panel) {
  const graded = gradedPhoto(img, panel.grade);
  const zoom = panel.zoom || 1;
  const base = Math.max(rect.w / graded.width, rect.h / graded.height) * zoom;
  const pw = graded.width * base;
  const ph = graded.height * base;
  const cx = rect.x + rect.w * (panel.x ?? 0.5);
  const cy = rect.y + rect.h * (panel.y ?? 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(graded, cx - pw / 2, cy - ph / 2, pw, ph);
  // Warm sunset wash rising from the panel's foot.
  const wash = ctx.createLinearGradient(0, rect.y + rect.h * 0.45, 0, rect.y + rect.h);
  wash.addColorStop(0, 'rgba(255,94,120,0)');
  wash.addColorStop(1, 'rgba(255,94,120,0.22)');
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  // White poster frame + ink line around the panel.
  ctx.lineWidth = Math.max(2, rect.w * 0.008);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.lineWidth = Math.max(1, rect.w * 0.003);
  ctx.strokeStyle = 'rgba(10,6,24,0.85)';
  ctx.strokeRect(rect.x + ctx.lineWidth * 2, rect.y + ctx.lineWidth * 2, rect.w - ctx.lineWidth * 4, rect.h - ctx.lineWidth * 4);
}

function drawSkyline(ctx, W, H, bandTop) {
  // Neon sunset sky, sun disc and a palm-and-tower skyline behind the title.
  // Everything sits in the band's right half so it never collides with the
  // title lettering on the left; towers and palms are anchored to the foot.
  const bandH = H - bandTop;
  const sky = ctx.createLinearGradient(0, bandTop - H * 0.05, 0, H);
  sky.addColorStop(0, '#ff7a3d');
  sky.addColorStop(0.45, '#ff2e88');
  sky.addColorStop(1, '#1a0b3d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, bandTop - H * 0.05, W, H - bandTop + H * 0.05);
  const sunR = bandH * 0.34;
  const sunX = W * 0.84;
  const sunY = bandTop + bandH * 0.34;
  const sun = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR);
  sun.addColorStop(0, '#fff3b0');
  sun.addColorStop(0.6, '#ffb03d');
  sun.addColorStop(1, 'rgba(255,94,120,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  const foot = H - bandH * 0.03;
  // Tower silhouettes, bottom-anchored, right half only.
  ctx.fillStyle = 'rgba(12,4,32,0.92)';
  const towers = [[0.6, 0.42], [0.67, 0.58], [0.74, 0.36], [0.9, 0.48]];
  for (const [fx, fh] of towers) {
    const tw = W * 0.045;
    const th = bandH * fh;
    ctx.fillRect(W * fx, foot - th, tw, th);
    // A tiny antenna on the tallest tower.
    if (fh > 0.5) ctx.fillRect(W * fx + tw / 2 - 1, foot - th - bandH * 0.12, 2, bandH * 0.12);
  }
  // Palm silhouettes: curved trunk, five drooping fronds, round caps.
  ctx.strokeStyle = 'rgba(12,4,32,0.95)';
  ctx.lineCap = 'round';
  for (const [fx, fh] of [[0.63, 0.72], [0.94, 0.62]]) {
    const baseX = W * fx;
    const topX = baseX + W * 0.018;
    const topY = foot - bandH * fh;
    ctx.lineWidth = Math.max(3, bandH * 0.035);
    ctx.beginPath();
    ctx.moveTo(baseX, foot);
    ctx.quadraticCurveTo(baseX + W * 0.004, foot - bandH * fh * 0.6, topX, topY);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, bandH * 0.028);
    for (let k = -2; k <= 2; k++) {
      const spread = (k / 2) * bandH * 0.3;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + spread * 0.7, topY - bandH * 0.16,
        topX + spread, topY + bandH * 0.1 + Math.abs(k) * bandH * 0.04,
      );
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
}

function fitFont(ctx, text, font, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px ${font}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${size}px ${font}`;
  }
  return size;
}

function drawTitleBlock(ctx, state, W, H) {
  const bandH = H * (state.layout === 'nine' ? 0.16 : state.layout === 'fullbleed' ? 0.24 : 0.22);
  const bandTop = H - bandH;
  drawSkyline(ctx, W, H, bandTop);
  const title = (state.caption || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim();
  const pad = W * 0.04;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (title) {
    const size = fitFont(ctx, title, TITLE_FONT, W - pad * 2, bandH * 0.52);
    const grad = ctx.createLinearGradient(0, bandTop + bandH * 0.1, 0, bandTop + bandH * 0.62);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#ffe9a8');
    grad.addColorStop(1, '#ff5e78');
    ctx.font = `${size}px ${TITLE_FONT}`;
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.04;
    ctx.fillText(title, pad, bandTop + bandH * 0.56);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // Thin chrome underline.
    ctx.fillStyle = '#2ee6ff';
    ctx.fillRect(pad, bandTop + bandH * 0.64, Math.min(W * 0.34, ctx.measureText(title).width), Math.max(3, H * 0.006));
  }
  if (sub) {
    const size = fitFont(ctx, sub, SCRIPT_FONT, W * 0.62, bandH * 0.26);
    ctx.font = `${size}px ${SCRIPT_FONT}`;
    ctx.fillStyle = '#7df9ff';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = size * 0.5;
    ctx.fillText(sub, pad, bandTop + bandH * 0.92);
    ctx.shadowBlur = 0;
  }
  if (state.badge) {
    const r = bandH * 0.3;
    const cx = W - pad - r;
    const cy = bandTop + bandH * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.12);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0618';
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = '#ffd166';
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(r * 0.34)}px ${TITLE_FONT}`;
    ctx.fillText('ROBO', 0, -r * 0.02);
    ctx.fillText('VICE', 0, r * 0.34);
    ctx.restore();
  }
}

/** Draws the whole cover onto `canvas` (any size) from `state` and `photos` (Map key -> Image). */
export function renderCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // Backdrop: deep violet so gutters read as poster board.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#160a2e');
  bg.addColorStop(1, '#0b0618');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (state.layout === 'tilted') {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2b0f4d');
    sky.addColorStop(0.55, '#ff2e88');
    sky.addColorStop(1, '#ffb03d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
  }
  const rects = layoutRects(state.layout, W, H);
  const count = Math.min(rects.length, state.panels.length);
  for (let i = 0; i < count; i++) {
    const panel = { ...state.panels[i], grade: state.grade };
    const img = photos.get(panel.photo);
    const rect = rects[i];
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    if (img) {
      drawPanelPhoto(ctx, img, rect, panel);
    } else {
      ctx.fillStyle = '#241640';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, rect.w * 0.008);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `${Math.round(rect.w * 0.06)}px ${TITLE_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    ctx.restore();
  }
  if (state.titleBlock) drawTitleBlock(ctx, state, W, H);
  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(5,2,16,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = getGrain(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  return rects;
}
