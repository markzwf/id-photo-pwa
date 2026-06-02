/**
 * 证件照制作 - 纯前端版
 * 改进版：GrabCut风格前景检测 + 边缘优化
 */

let state = {
  file: null,
  color: '#438edb',
  width: 295,
  height: 413,
  result: null,
};

const $ = (sel) => document.querySelector(sel);
const uploadArea = $('#uploadArea');
const fileInput = $('#fileInput');
const preview = $('#preview');
const uploadContent = $('#uploadContent');
const processBtn = $('#processBtn');
const resultPage = $('#resultPage');
const resultImg = $('#resultImg');
const modelStatus = $('#modelStatus');

function init() {
  modelStatus.innerHTML = '✅ 就绪';
  modelStatus.style.color = '#28a745';
  processBtn.disabled = false;

  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  document.querySelectorAll('.color-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector('.color-item.active').classList.remove('active');
      btn.classList.add('active');
      state.color = btn.dataset.color;
    });
  });

  document.querySelectorAll('.size-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector('.size-item.active').classList.remove('active');
      btn.classList.add('active');
      state.width = parseInt(btn.dataset.w);
      state.height = parseInt(btn.dataset.h);
    });
  });

  processBtn.addEventListener('click', handleProcess);
  $('#backBtn').addEventListener('click', () => resultPage.classList.remove('show'));
  $('#retryBtn').addEventListener('click', () => { resultPage.classList.remove('show'); state.result = null; });
  $('#saveBtn').addEventListener('click', handleSave);
}

function handleFileSelect(e) {
  if (e.target.files.length) handleFile(e.target.files[0]);
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return; }
  state.file = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    uploadContent.style.display = 'none';
    uploadArea.style.border = '2px solid #667eea';
  };
  reader.readAsDataURL(file);
}

async function handleProcess() {
  if (!state.file) return;

  processBtn.querySelector('.btn-text').hidden = true;
  processBtn.querySelector('.btn-loading').hidden = false;
  processBtn.disabled = true;

  try {
    const img = await loadImage(state.file);
    const dataUrl = compositeWithBackground(img, state.color, state.width, state.height);
    state.result = dataUrl;
    resultImg.src = dataUrl;
    resultPage.classList.add('show');
  } catch (err) {
    alert('处理失败：' + err.message);
    console.error(err);
  } finally {
    processBtn.querySelector('.btn-text').hidden = false;
    processBtn.querySelector('.btn-loading').hidden = true;
    processBtn.disabled = false;
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ===== GrabCut 风格前景检测 =====
function grabCutForeground(imageData, w, h) {
  const data = imageData.data;
  const mask = new Float32Array(w * h); // 0=背景, 1=前景

  // 1. 初始化：用矩形框标记可能的前景区域（中心70%）
  const marginX = Math.floor(w * 0.15);
  const marginY = Math.floor(h * 0.15);

  // 2. 采样边缘作为背景模型
  const bgPixels = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < marginX || x >= w - marginX || y < marginY || y >= h - marginY) {
        const i = (y * w + x) * 4;
        bgPixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }

  // 3. 采样中心作为前景模型
  const fgPixels = [];
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const fgRadius = Math.min(w, h) * 0.2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < fgRadius) {
        const i = (y * w + x) * 4;
        fgPixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }

  // 4. 计算颜色直方图（简化版：用均值和方差）
  function calcStats(pixels) {
    const n = pixels.length;
    if (n === 0) return { mean: [128, 128, 128], std: [50, 50, 50] };
    const mean = [0, 0, 0];
    pixels.forEach(([r, g, b]) => { mean[0] += r; mean[1] += g; mean[2] += b; });
    mean[0] /= n; mean[1] /= n; mean[2] /= n;
    const std = [0, 0, 0];
    pixels.forEach(([r, g, b]) => {
      std[0] += (r - mean[0]) ** 2;
      std[1] += (g - mean[1]) ** 2;
      std[2] += (b - mean[2]) ** 2;
    });
    std[0] = Math.sqrt(std[0] / n) + 1;
    std[1] = Math.sqrt(std[1] / n) + 1;
    std[2] = Math.sqrt(std[2] / n) + 1;
    return { mean, std };
  }

  const bgStats = calcStats(bgPixels);
  const fgStats = calcStats(fgPixels);

  // 5. 计算每个像素属于前景/背景的概率
  function colorDist(px, stats) {
    const dr = (px[0] - stats.mean[0]) / stats.std[0];
    const dg = (px[1] - stats.mean[1]) / stats.std[1];
    const db = (px[2] - stats.mean[2]) / stats.std[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // 6. 迭代优化（简化GrabCut：3轮迭代）
  for (let iter = 0; iter < 3; iter++) {
    // 重新计算前景/背景统计
    const fgUsed = [], bgUsed = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const i = idx * 4;
        const px = [data[i], data[i + 1], data[i + 2]];
        const fgDist = colorDist(px, fgStats);
        const bgDist = colorDist(px, bgStats);

        // 边缘权重：越靠近边缘越可能是背景
        const edgeX = Math.min(x, w - 1 - x) / (w / 2);
        const edgeY = Math.min(y, h - 1 - y) / (h / 2);
        const edgeWeight = Math.min(edgeX, edgeY);

        // 距离中心的权重
        const cx2 = (x / w - 0.5) * 2;
        const cy2 = (y / h - 0.5) * 2;
        const centerDist = Math.sqrt(cx2 * cx2 + cy2 * cy2);

        // 综合判断
        const fgScore = fgDist - bgDist + centerDist * 2 - edgeWeight * 1.5;
        mask[idx] = fgScore < 0 ? 1 : 0;
      }
    }

    // 重新统计
    fgUsed.length = 0;
    bgUsed.length = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const i = idx * 4;
        if (mask[idx] > 0.5) {
          fgUsed.push([data[i], data[i + 1], data[i + 2]]);
        } else {
          bgUsed.push([data[i], data[i + 1], data[i + 2]]);
        }
      }
    }

    if (fgUsed.length > 10) Object.assign(fgStats, calcStats(fgUsed));
    if (bgUsed.length > 10) Object.assign(bgStats, calcStats(bgUsed));
  }

  // 7. 边缘平滑（高斯模糊近似）
  const smoothMask = new Float32Array(w * h);
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1]
  ];
  const kSum = 16;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += mask[(y + ky) * w + (x + kx)] * kernel[ky + 1][kx + 1];
        }
      }
      smoothMask[y * w + x] = sum / kSum;
    }
  }

  return smoothMask;
}

// ===== 合成证件照 =====
function compositeWithBackground(originalImg, bgColor, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = originalImg.width;
  canvas.height = originalImg.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(originalImg, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;

  // GrabCut 前景检测
  const mask = grabCutForeground(imageData, w, h);

  // 创建前景 canvas
  const fgCanvas = document.createElement('canvas');
  fgCanvas.width = w;
  fgCanvas.height = h;
  const fgCtx = fgCanvas.getContext('2d');
  fgCtx.drawImage(originalImg, 0, 0);

  // 应用 mask（alpha 通道）
  const fgData = fgCtx.getImageData(0, 0, w, h);
  for (let i = 0; i < mask.length; i++) {
    fgData.data[i * 4 + 3] = Math.floor(mask[i] * 255);
  }
  fgCtx.putImageData(fgData, 0, 0);

  // 合成到目标尺寸
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetWidth;
  outCanvas.height = targetHeight;
  const outCtx = outCanvas.getContext('2d');

  // 画背景色
  outCtx.fillStyle = bgColor;
  outCtx.fillRect(0, 0, targetWidth, targetHeight);

  // 计算前景尺寸（居中，留 8% 边距）
  const padding = 0.08;
  const maxW = targetWidth * (1 - padding * 2);
  const maxH = targetHeight * (1 - padding * 2);
  const scale = Math.min(maxW / w, maxH / h);
  const newW = w * scale;
  const newH = h * scale;
  const x = (targetWidth - newW) / 2;
  const y = (targetHeight - newH) / 2;

  outCtx.drawImage(fgCanvas, x, y, newW, newH);

  return outCanvas.toDataURL('image/png');
}

function handleSave() {
  if (!state.result) return;
  const link = document.createElement('a');
  link.download = `证件照_${Date.now()}.png`;
  link.href = state.result;
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    const win = window.open();
    if (win) {
      win.document.write(`<img src="${state.result}" style="max-width:100%">`);
      win.document.write('<p style="text-align:center;padding:20px">长按图片保存</p>');
    }
  } else {
    link.click();
  }
}

document.addEventListener('DOMContentLoaded', init);
