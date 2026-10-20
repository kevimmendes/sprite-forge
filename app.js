const FRAME_W = 16, FRAME_H = 32;
const DIRS = ['baixo', 'direita', 'esquerda', 'cima'];
const FRAMES_PER_DIR = 4;
const SCALE = 16;

const state = {
  frames: [],
  sourceImg: null,
  grid: null,
  gridCustom: false,
  gridCells: [],
  currentDir: 0,
  currentFrame: 0,
  speed: 4,
  animFrame: 0,
  animTimer: null,
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
const colsInput = document.getElementById('colsInput');
const rowsInput = document.getElementById('rowsInput');

function idx(x, y) { return y * FRAME_W + x; }
function inBounds(x, y) { return x >= 0 && x < FRAME_W && y >= 0 && y < FRAME_H; }

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return { r: parseInt(m.substring(0, 2), 16), g: parseInt(m.substring(2, 4), 16), b: parseInt(m.substring(4, 6), 16) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
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
  editorCtx.lineWidth = 1;
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
  if (!state.sourceImg) return;
  const img = state.sourceImg;
  const scale = Math.min(refCanvas.width / img.width, refCanvas.height / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  refCtx.drawImage(img, (refCanvas.width - w) / 2, (refCanvas.height - h) / 2, w, h);
  if (state.grid) {
    const { cols, rows } = state.grid;
    const x0 = (refCanvas.width - w) / 2, y0 = (refCanvas.height - h) / 2;
    refCtx.strokeStyle = 'rgba(232,160,160,0.55)';
    refCtx.lineWidth = 1;
    for (let i = 1; i < cols; i++) {
      const x = Math.round(x0 + (w / cols) * i);
      refCtx.beginPath(); refCtx.moveTo(x, y0); refCtx.lineTo(x, y0 + h); refCtx.stroke();
    }
    for (let i = 1; i < rows; i++) {
      const y = Math.round(y0 + (h / rows) * i);
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
  for (let y = FRAME_H - 1; y >= 0; y--) {
    for (let x = 0; x < FRAME_W; x++) {
      if (frameData[idx(x, y)]) return y;
    }
  }
  return FRAME_H;
}

function mirrorFrame(frameData) {
  const m = new Array(FRAME_W * FRAME_H).fill(null);
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      m[idx(x, y)] = frameData[idx(FRAME_W - 1 - x, y)];
    }
  }
  return m;
}

function shiftRegion(frame, x0, y0, w, h, dx, dy) {
  const out = frame.slice();
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) out[idx(x, y)] = null;
  }
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const c = frame[idx(x, y)];
      if (c && inBounds(x + dx, y + dy)) out[idx(x + dx, y + dy)] = c;
    }
  }
  return out;
}

function makeWalkFrames(idle) {
  return [
    idle.slice(),
    shiftRegion(idle, 0, 16, FRAME_W, 16, 1, 0),
    idle.slice(),
    shiftRegion(idle, 0, 16, FRAME_W, 16, -1, 0),
  ];
}

function cellToPixels(img, px, py, pw, ph) {
  const cell = document.createElement('canvas');
  cell.width = pw;
  cell.height = ph;
  const cctx = cell.getContext('2d');
  cctx.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);
  const data = cctx.getImageData(0, 0, pw, ph).data;
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

function extractSingle(img) {
  const c = document.createElement('canvas');
  c.width = FRAME_W;
  c.height = FRAME_H;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, FRAME_W, FRAME_H);
  const data = ctx.getImageData(0, 0, FRAME_W, FRAME_H).data;
  const pixels = new Array(FRAME_W * FRAME_H).fill(null);
  for (let i = 0; i < FRAME_W * FRAME_H; i++) {
    if (data[i * 4 + 3] < 100) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    if (r < 30 && g < 25 && b < 40) continue;
    pixels[i] = rgbToHex(r, g, b);
  }
  return pixels;
}

function detectGrid(img) {
  const w = img.width, h = img.height;
  if (w < 64 || h < 64) return null;
  const cols = 4;
  const rows = Math.max(1, Math.round((h / w) * (cols / 2)));
  return { cols, rows };
}

function buildGridCells(img, cols, rows) {
  const cw = Math.floor(img.width / cols);
  const ch = Math.floor(img.height / rows);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(cellToPixels(img, c * cw, r * ch, cw, ch));
    }
  }
  return cells;
}

function generateFromImage() {
  const img = state.sourceImg;
  if (!img) { toast('Carregue uma imagem primeiro!', true); return; }

  let grid = state.gridCustom ? state.grid : detectGrid(img);
  if (grid) {
    state.grid = grid;
    colsInput.value = grid.cols;
    rowsInput.value = grid.rows;
  }
  if (grid) {
    state.grid = grid;
    const cells = buildGridCells(img, grid.cols, grid.rows);
    state.gridCells = cells;
    for (let d = 0; d < 4 && d < grid.rows; d++) {
      const row = cells.slice(d * grid.cols, d * grid.cols + grid.cols);
      const frames = [];
      for (let f = 0; f < FRAMES_PER_DIR; f++) {
        frames.push(row[f % row.length].slice());
      }
      state.frames[d] = frames;
    }
    state.frames[2] = state.frames[1].map(mirrorFrame);
    state.frames[3] = state.frames[3].map(mirrorFrame).map(mirrorFrame);
  } else {
    const idle = extractSingle(img);
    const walk = makeWalkFrames(idle);
    state.frames[0] = walk.map(f => f.slice());
    state.frames[1] = walk.map(f => f.slice());
    state.frames[2] = walk.map(mirrorFrame);
    state.frames[3] = walk.map(f => f.slice());
  }

  drawSheet();
  drawEditor();
  drawPreview();
  drawRef();
  toast('Sprite sheet gerada!');
}

function loadDemo() {
  const rows = [
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
    const row = d === 2 ? rows[1] : rows[0];
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
  toast('Exemplo carregado!');
}

function buildStandardSheet(scale) {
  const c = document.createElement('canvas');
  c.width = FRAME_W * FRAMES_PER_DIR * scale;
  c.height = FRAME_H * 4 * scale;
  const ctx = c.getContext('2d');
  for (let d = 0; d < 4; d++) {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      drawFramePixels(ctx, state.frames[d][f], f * FRAME_W * scale, d * FRAME_H * scale, scale, true);
    }
  }
  return c;
}

function buildFullGridSheet(scale) {
  const cells = state.gridCells;
  const grid = state.grid || { cols: FRAMES_PER_DIR, rows: 4 };
  const c = document.createElement('canvas');
  c.width = grid.cols * FRAME_W * scale;
  c.height = grid.rows * FRAME_H * scale;
  const ctx = c.getContext('2d');
  if (cells.length === grid.cols * grid.rows) {
    for (let i = 0; i < cells.length; i++) {
      const d = Math.floor(i / grid.cols);
      const f = i % grid.cols;
      drawFramePixels(ctx, cells[i], f * FRAME_W * scale, d * FRAME_H * scale, scale, true);
    }
  } else {
    for (let d = 0; d < 4; d++) {
      for (let f = 0; f < FRAMES_PER_DIR; f++) {
        drawFramePixels(ctx, state.frames[d][f], f * FRAME_W * scale, d * FRAME_H * scale, scale, true);
      }
    }
  }
  return c;
}

function downloadDataURL(dataURL, filename) {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = filename;
  a.click();
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

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      state.sourceImg = img;
      state.gridCustom = false;
      const detected = detectGrid(img);
      if (detected) {
        state.grid = detected;
        colsInput.value = detected.cols;
        rowsInput.value = detected.rows;
      } else {
        state.grid = null;
      }
      drawRef();
      document.getElementById('btnGenerate').disabled = false;
      generateFromImage();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('change', e => handleFile(e.target.files[0]));
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  handleFile(e.dataTransfer.files[0]);
});

document.getElementById('btnGenerate').addEventListener('click', generateFromImage);
document.getElementById('btnDetect').addEventListener('click', () => {
  const img = state.sourceImg;
  if (!img) { toast('Carregue uma imagem primeiro!', true); return; }
  const cols = Math.max(1, parseInt(colsInput.value) || 4);
  const rows = Math.max(1, parseInt(rowsInput.value) || 4);
  state.grid = { cols, rows };
  state.gridCustom = true;
  drawRef();
  toast(`Grade definida: ${cols}×${rows}`);
});
document.getElementById('btnDemo').addEventListener('click', loadDemo);

document.getElementById('btnPng').addEventListener('click', () => {
  downloadDataURL(buildStandardSheet(4).toDataURL('image/png'), 'stardew_sprite.png');
  toast('PNG padrão exportado!');
});
document.getElementById('btnPngFull').addEventListener('click', () => {
  downloadDataURL(buildFullGridSheet(4).toDataURL('image/png'), 'stardew_sprite_full.png');
  toast('PNG da grade completa exportado!');
});
document.getElementById('btnGif').addEventListener('click', () => {
  const framesData = [];
  for (let d = 0; d < 4; d++) {
    for (let f = 0; f < FRAMES_PER_DIR; f++) framesData.push(state.frames[d][f].slice());
  }
  const delay = Math.round(1000 / (state.speed * 2));
  const gifBytes = buildGif(framesData, FRAME_W, FRAME_H, delay);
  const blob = new Blob([gifBytes], { type: 'image/gif' });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, 'stardew_animation.gif');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('GIF exportado!');
});
document.getElementById('btnJson').addEventListener('click', () => {
  const data = {
    format: 'stardew-valley-sprite', frameWidth: FRAME_W, frameHeight: FRAME_H,
    directions: DIRS, framesPerDirection: FRAMES_PER_DIR, frames: state.frames,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, 'stardew_sprite_data.json');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('JSON exportado!');
});
document.getElementById('btnClear').addEventListener('click', () => {
  for (let d = 0; d < 4; d++) {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      state.frames[d][f] = new Array(FRAME_W * FRAME_H).fill(null);
    }
  }
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
