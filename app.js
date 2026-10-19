const FRAME_W = 16, FRAME_H = 32;
const DIRS = ['baixo', 'direita', 'esquerda', 'cima'];
const FRAMES_PER_DIR = 4;
const SCALE = 16;

const state = {
  frames: [],
  palette: [],
  currentDir: 0,
  currentFrame: 0,
  speed: 4,
  animFrame: 0,
  sourceImg: null,
  sourceCells: [],
};

for (let d = 0; d < 4; d++) {
  state.frames[d] = [];
  for (let f = 0; f < FRAMES_PER_DIR; f++) {
    state.frames[d][f] = new Array(FRAME_W * FRAME_H).fill(null);
  }
}

const editor = document.getElementById('editor');
const editorCtx = editor.getContext('2d');
const preview = document.getElementById('preview');
const previewCtx = preview.getContext('2d');
const sheetView = document.getElementById('sheetView');
const sheetCtx = sheetView.getContext('2d');
const refCanvas = document.getElementById('refCanvas');
const refCtx = refCanvas.getContext('2d');

function idx(x, y) { return y * FRAME_W + x; }
function inBounds(x, y) { return x >= 0 && x < FRAME_W && y >= 0 && y < FRAME_H; }

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return { r: parseInt(m.substring(0, 2), 16), g: parseInt(m.substring(2, 4), 16), b: parseInt(m.substring(4, 6), 16) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function drawFramePixels(ctx, frameData, dx, dy, scale, transparent) {
  const img = ctx.createImageData(FRAME_W, FRAME_H);
  for (let i = 0; i < FRAME_W * FRAME_H; i++) {
    const c = frameData[i];
    if (c) {
      const rgb = hexToRgb(c);
      img.data[i * 4] = rgb.r;
      img.data[i * 4 + 1] = rgb.g;
      img.data[i * 4 + 2] = rgb.b;
      img.data[i * 4 + 3] = 255;
    } else if (!transparent) {
      img.data[i * 4] = 24;
      img.data[i * 4 + 1] = 18;
      img.data[i * 4 + 2] = 34;
      img.data[i * 4 + 3] = 255;
    }
  }
  const temp = document.createElement('canvas');
  temp.width = FRAME_W;
  temp.height = FRAME_H;
  temp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, dx, dy, FRAME_W * scale, FRAME_H * scale);
}

function drawSheet() {
  sheetCtx.clearRect(0, 0, sheetView.width, sheetView.height);
  for (let d = 0; d < 4; d++) {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      drawFramePixels(sheetCtx, state.frames[d][f], f * FRAME_W * SCALE, d * FRAME_H * SCALE, SCALE, true);
    }
  }
}

function drawPreview() {
  const f = state.animFrame % FRAMES_PER_DIR;
  drawFramePixels(previewCtx, state.frames[0][f], 0, 0, 6, true);
}

function drawEditor() {
  editorCtx.clearRect(0, 0, editor.width, editor.height);
  drawFramePixels(editorCtx, state.frames[state.currentDir][state.currentFrame], 0, 0, SCALE, false);
  editorCtx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let x = 0; x <= FRAME_W; x++) {
    editorCtx.beginPath();
    editorCtx.moveTo(x * SCALE, 0);
    editorCtx.lineTo(x * SCALE, editor.height);
    editorCtx.stroke();
  }
  for (let y = 0; y <= FRAME_H; y++) {
    editorCtx.beginPath();
    editorCtx.moveTo(0, y * SCALE);
    editorCtx.lineTo(editor.width, y * SCALE);
    editorCtx.stroke();
  }
}

function drawRef() {
  refCtx.imageSmoothingEnabled = false;
  refCtx.clearRect(0, 0, refCanvas.width, refCanvas.height);
  if (!state.sourceImg) {
    refCtx.fillStyle = '#a895c8';
    refCtx.font = '14px sans-serif';
    refCtx.textAlign = 'center';
    refCtx.fillText('Sem imagem', refCanvas.width / 2, refCanvas.height / 2);
    return;
  }
  const img = state.sourceImg;
  const scale = Math.min(refCanvas.width / img.width, refCanvas.height / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  refCtx.drawImage(img, (refCanvas.width - w) / 2, (refCanvas.height - h) / 2, w, h);
  if (state.sourceCells.length === 16) {
    refCtx.strokeStyle = 'rgba(232,160,160,0.6)';
    refCtx.lineWidth = 1;
    const x0 = (refCanvas.width - w) / 2, y0 = (refCanvas.height - h) / 2;
    for (let i = 1; i < 4; i++) {
      const x = Math.round(x0 + (w / 4) * i);
      refCtx.beginPath(); refCtx.moveTo(x, y0); refCtx.lineTo(x, y0 + h); refCtx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const y = Math.round(y0 + (h / 4) * i);
      refCtx.beginPath(); refCtx.moveTo(x0, y); refCtx.lineTo(x0 + w, y); refCtx.stroke();
    }
  }
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = isError ? 'error show' : 'show';
  setTimeout(() => el.classList.remove('show', 'error'), 2500);
}

function getFootY(frameData) {
  for (let y = FRAME_H - 1; y >= 0; y--)
    for (let x = 0; x < FRAME_W; x++)
      if (frameData[idx(x, y)]) return y;
  return FRAME_H;
}

function mirrorFrame(frameData) {
  const m = new Array(FRAME_W * FRAME_H).fill(null);
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++)
      m[idx(x, y)] = frameData[idx(FRAME_W - 1 - x, y)];
  return m;
}

function cellToPixels(img, px, py, pw, ph) {
  const cell = document.createElement('canvas');
  cell.width = pw; cell.height = ph;
  const cctx = cell.getContext('2d');
  cctx.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);
  const data = cctx.getImageData(0, 0, pw, ph);
  const pixels = new Array(FRAME_W * FRAME_H).fill(null);
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const sx = Math.min(pw - 1, Math.floor(x / FRAME_W * pw));
      const sy = Math.min(ph - 1, Math.floor(y / FRAME_H * ph));
      const i = (sy * pw + sx) * 4;
      if (data[i + 3] < 100) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < 30 && g < 25 && b < 40) continue;
      pixels[idx(x, y)] = rgbToHex(r, g, b);
    }
  }
  return pixels;
}

function detectCells(img) {
  const w = img.width, h = img.height;
  const cells = [];
  const is4x4 = (w / 4 === h / 4);
  if (is4x4 && w >= 64 && h >= 64) {
    const cw = Math.floor(w / 4), ch = Math.floor(h / 4);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        cells.push({ x: c * cw, y: r * ch, w: cw, h: ch });
    return cells;
  }
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      cells.push({ x: 0, y: 0, w: w, h: h });
  return cells;
}

function generateFromImage() {
  const img = state.sourceImg;
  if (!img) { toast('Escolha uma imagem primeiro!', true); return; }

  const cells = detectCells(img);
  state.sourceCells = cells;
  const allCells = cells.map(c => cellToPixels(img, c.x, c.y, c.w, c.h));

  const paletteSet = new Set();
  allCells.forEach(c => c.forEach(p => { if (p) paletteSet.add(p); }));
  state.palette = Array.from(paletteSet).slice(0, 48);

  for (let r = 0; r < 4; r++) {
    const row = allCells.slice(r * 4, r * 4 + 4);
    const classified = row.map(f => ({ data: f, footY: getFootY(f) }));
    const idle = classified.filter(f => f.footY <= FRAME_H - 3);
    const walk = classified.filter(f => f.footY >= FRAME_H - 2);
    const sorted = [...idle.slice(0, 2), ...walk.slice(0, 2)];
    while (sorted.length < FRAMES_PER_DIR) {
      sorted.push(sorted[0] ? sorted[0].data.slice() : new Array(FRAME_W * FRAME_H).fill(null));
    }
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      state.frames[r][f] = sorted[f].data.slice();
    }
  }

  state.frames[2] = state.frames[1].map(mirrorFrame);

  drawSheet();
  drawEditor();
  drawPreview();
  drawRef();
  toast('Sprite gerada com sucesso!');
}

function loadDemo() {
  const demoRows = [
    [
      '................','....bbbbbbbb....','...bhhhhhhhhb...','..bhhrrrrrrhhb..',
      '..bhrwwwwwwrhb..','..bhrwkkkkwrhb..','..bhrwkkkkwrhb..','..bhrwwwwwwrhb..',
      '..bhrwwwwwwrhb..','..bhhrrrrrrhhb..','..bhhrrrrrrhhb..','...brrrrrrrrb...',
      '..bbttttttttbb..','..bsttttttttsb..','..bsttttttttsb..','..bttttttttttb..',
      '..bttttttttttb..','..bttttttttttb..','...bbbbbbbbbb...','..bbb......bbb..',
      '..bbb......bbb..','..bbb......bbb..','..bbb......bbb..','..bbb......bbb..',
      '..bbb......bbb..','..bbb......bbb..','..bbbbbbbbbbbb..','..bbbbbbbbbbbb..',
      '..bbbbbbbbbbbb..','..bbbbbbbbbbbb..','.bbbbbbbbbbbbbb.','.bbbbbbbbbbbbbb.',
    ],
    [
      '................','....bbbbbbbb....','...bhhhhhhhhb...','..bhhrrrrrrhhb..',
      '..bhrwwwwwwrhb..','..bhrwkkkkwrhb..','..bhrwkkkkwrhb..','..bhrwwwwwwrhb..',
      '..bhrwwwwwwrhb..','..bhhrrrrrrhhb..','..bhhrrrrrrhhb..','...brrrrrrrrb...',
      '..bbttttttttbb..','..bsttttttttsb..','..bsttttttttsb..','..bttttttttttb..',
      '..bttttttttttb..','..bttttttttttb..','..bbbbbbbbbbbb..','...bbbbbbbbbb...',
      '...bbbbbbbbbb...','....bbbbbbbb....','....bbbbbbbb....','....bbbbbbbb....',
      '....bbbbbbbb....','....bbbbbbbb....','....bbbbbbbb....','....bbbbbbbb....',
      '....bbbbbbbb....','....bbbbbbbb....','....bbbbbbbb....','....bbbbbbbb....',
    ],
  ];
  const palette = { b: '#2a1a3a', h: '#f0d0a0', r: '#e8a0a0', w: '#ffffff', k: '#1a1a2e', t: '#4a6fa5', s: '#d4a574' };
  for (let d = 0; d < 4; d++) {
    const row = d === 2 ? demoRows[1] : demoRows[0];
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      const pixels = new Array(FRAME_W * FRAME_H).fill(null);
      const offset = f === 1 ? 1 : f === 3 ? -1 : 0;
      for (let y = 0; y < FRAME_H; y++) {
        const sy = Math.max(0, Math.min(FRAME_H - 1, y - offset));
        for (let x = 0; x < FRAME_W; x++) {
          const ch = row[sy][x];
          if (ch !== '.') pixels[idx(x, y)] = palette[ch] || '#ff00ff';
        }
      }
      state.frames[d][f] = pixels;
    }
  }
  state.frames[2] = state.frames[1].map(mirrorFrame);
  drawSheet();
  drawEditor();
  drawPreview();
  toast('Demo carregado! Navegue pelos frames com os botões.');
}

function buildSheetDataURL(scale = 1) {
  const c = document.createElement('canvas');
  c.width = FRAME_W * FRAMES_PER_DIR * scale;
  c.height = FRAME_H * 4 * scale;
  const ctx = c.getContext('2d');
  for (let d = 0; d < 4; d++)
    for (let f = 0; f < FRAMES_PER_DIR; f++)
      drawFramePixels(ctx, state.frames[d][f], f * FRAME_W * scale, d * FRAME_H * scale, scale, true);
  return c.toDataURL('image/png');
}

function buildGif(framesData, w, h, delayMs) {
  const bytes = [];
  const writeByte = b => bytes.push(b & 0xff);
  const writeShort = s => { writeByte(s); writeByte(s >> 8); };
  const writeBytes = arr => arr.forEach(writeByte);
  const writeString = s => { for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i)); };

  writeString('GIF89a');
  writeShort(w); writeShort(h);
  writeByte(0xf7); writeByte(0); writeByte(0);

  const globalPalette = buildGlobalPalette(framesData);
  const colorCount = Math.pow(2, Math.ceil(Math.log2(Math.max(2, globalPalette.length))));
  for (let i = 0; i < colorCount; i++) {
    if (i < globalPalette.length) {
      const rgb = hexToRgb(globalPalette[i]);
      writeByte(rgb.r); writeByte(rgb.g); writeByte(rgb.b);
    } else { writeByte(0); writeByte(0); writeByte(0); }
  }

  writeByte(0x21); writeByte(0xff); writeByte(11);
  writeString('NETSCAPE2.0');
  writeByte(3); writeByte(1); writeShort(0); writeByte(0);

  framesData.forEach(frame => {
    writeByte(0x21); writeByte(0xf9); writeByte(4);
    writeByte(0x04); writeShort(Math.round(delayMs / 10)); writeByte(0); writeByte(0);
    writeByte(0x2c); writeShort(0); writeShort(0); writeShort(w); writeShort(h); writeByte(0);
    const indexed = mapFrameToPalette(frame, globalPalette);
    const minBits = Math.max(1, Math.ceil(Math.log2(colorCount)));
    writeByte(minBits);
    const compressed = lzwEncode(indexed, minBits);
    for (let i = 0; i < compressed.length; i += 255) {
      const chunk = compressed.slice(i, i + 255);
      writeByte(chunk.length); writeBytes(chunk);
    }
    writeByte(0);
  });

  writeByte(0x3b);
  return new Uint8Array(bytes);
}

function buildGlobalPalette(framesData) {
  const colors = new Set();
  framesData.forEach(frame => frame.forEach(c => { if (c) colors.add(c); }));
  return Array.from(colors);
}

function mapFrameToPalette(frame, palette) {
  return frame.map(c => { if (!c) return 0; const i = palette.indexOf(c); return i >= 0 ? i : 0; });
}

function lzwEncode(indexed, minBits) {
  const clearCode = 1 << minBits, eoiCode = clearCode + 1;
  let codeSize = minBits + 1, nextCode = eoiCode + 1, dict = {};
  const out = []; let bitBuffer = 0, bitCount = 0;
  function emit(code) {
    bitBuffer |= code << bitCount; bitCount += codeSize;
    while (bitCount >= 8) { out.push(bitBuffer & 0xff); bitBuffer >>= 8; bitCount -= 8; }
  }
  function resetDict() { dict = {}; nextCode = eoiCode + 1; codeSize = minBits + 1; }
  emit(clearCode); resetDict();
  let prev = null;
  for (let i = 0; i < indexed.length; i++) {
    const k = indexed[i];
    if (prev === null) { prev = k; continue; }
    const key = prev * 100000 + k;
    if (dict.hasOwnProperty(key)) { prev = dict[key]; }
    else {
      emit(prev); dict[key] = nextCode++;
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      else if (nextCode >= 4096) { emit(clearCode); resetDict(); }
      prev = k;
    }
  }
  if (prev !== null) emit(prev);
  emit(eoiCode);
  if (bitCount > 0) out.push(bitBuffer & 0xff);
  return out;
}

function startAnim() {
  stopAnim();
  const delay = Math.round(1000 / (state.speed * 2));
  state.animTimer = setInterval(() => { state.animFrame++; drawPreview(); }, delay);
}
function stopAnim() { if (state.animTimer) { clearInterval(state.animTimer); state.animTimer = null; } }

document.getElementById('refInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      state.sourceImg = img;
      drawRef();
      generateFromImage();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById('btnDemo').addEventListener('click', loadDemo);
document.getElementById('btnPng').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = buildSheetDataURL(4);
  a.download = 'stardew_sprite.png';
  a.click();
  toast('PNG exportado!');
});

document.getElementById('btnGif').addEventListener('click', () => {
  const framesData = [];
  for (let d = 0; d < 4; d++)
    for (let f = 0; f < FRAMES_PER_DIR; f++)
      framesData.push(state.frames[d][f].slice());
  const delay = Math.round(1000 / (state.speed * 2));
  const gifBytes = buildGif(framesData, FRAME_W, FRAME_H, delay);
  const blob = new Blob([gifBytes], { type: 'image/gif' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'stardew_animation.gif'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('GIF exportado!');
});

document.getElementById('btnJson').addEventListener('click', () => {
  const data = { format: 'stardew-valley-sprite', frameWidth: FRAME_W, frameHeight: FRAME_H, directions: DIRS, framesPerDirection: FRAMES_PER_DIR, frames: state.frames };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'stardew_sprite_data.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('JSON exportado!');
});

document.getElementById('btnClear').addEventListener('click', () => {
  for (let d = 0; d < 4; d++)
    for (let f = 0; f < FRAMES_PER_DIR; f++)
      state.frames[d][f] = new Array(FRAME_W * FRAME_H).fill(null);
  drawSheet(); drawEditor();
  toast('Limpo!');
});

document.getElementById('speed').addEventListener('input', e => { state.speed = parseInt(e.target.value); });

document.querySelectorAll('.frame-btn[data-d]').forEach(btn => {
  btn.addEventListener('click', () => { state.currentDir = parseInt(btn.dataset.d); drawEditor(); });
});
document.querySelectorAll('.frame-btn[data-f]').forEach(btn => {
  btn.addEventListener('click', () => { state.currentFrame = parseInt(btn.dataset.f); drawEditor(); });
});

document.addEventListener('DOMContentLoaded', () => { loadDemo(); startAnim(); });
