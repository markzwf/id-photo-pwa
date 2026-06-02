/**
 * 证件照制作 - 纯前端版
 * 使用简单图像处理算法抠图（无需外部模型）
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
  modelStatus.innerHTML = '✅ 就绪（无需加载模型）';
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

function compositeWithBackground(originalImg, bgColor, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = originalImg.width;
  canvas.height = originalImg.height;
  const ctx = canvas.getContext('2d');

  // 画原图
  ctx.drawImage(originalImg, 0, 0);

  // 获取像素数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 简单的 GrabCut 前景检测：基于颜色聚类
  // 这里用简单方法：假设背景是相对均匀的颜色，人物在中央区域
  const w = canvas.width;
  const h = canvas.height;

  // 采样四角和边缘的颜色作为背景参考
  const bgSamples = [];
  const sampleSize = Math.floor(Math.min(w, h) * 0.05);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 只采样边缘像素
      if (x < sampleSize || x >= w - sampleSize || y < sampleSize || y >= h - sampleSize) {
        const i = (y * w + x) * 4;
        bgSamples.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }

  // 计算背景平均颜色
  let bgR = 0, bgG = 0, bgB = 0;
  bgSamples.forEach(([r, g, b]) => { bgR += r; bgG += g; bgB += b; });
  bgR = Math.floor(bgR / bgSamples.length);
  bgG = Math.floor(bgG / bgSamples.length);
  bgB = Math.floor(bgB / bgSamples.length);

  // 计算颜色阈值（标准差）
  let sumDiff = 0;
  bgSamples.forEach(([r, g, b]) => {
    sumDiff += Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
  });
  const threshold = Math.max(60, Math.floor(sumDiff / bgSamples.length * 2));

  // 创建 mask：与背景颜色相近的是背景，其余是前景
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d');
  const maskData = maskCtx.createImageData(w, h);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

    // 中心区域更可能是人物
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    const centerDist = Math.sqrt(
      Math.pow((px / w - 0.5) * 2, 2) + Math.pow((py / h - 0.5) * 2, 2)
    );

    // 边缘权重：越靠近边缘越可能是背景
    const edgeWeight = Math.min(1, centerDist * 1.5);

    if (diff < threshold * (0.5 + edgeWeight * 0.5)) {
      // 背景 - 透明
      maskData.data[i + 3] = 0;
    } else {
      // 前景 - 不透明
      maskData.data[i + 3] = 255;
    }
  }
  maskCtx.putImageData(maskData, 0, 0);

  // 对 mask 进行模糊处理（平滑边缘）
  maskCtx.filter = 'blur(3px)';
  maskCtx.drawImage(maskCanvas, 0, 0);
  maskCtx.filter = 'none';

  // 重新读取 mask 数据，二值化
  const maskData2 = maskCtx.getImageData(0, 0, w, h);
  for (let i = 3; i < maskData2.data.length; i += 4) {
    maskData2.data[i] = maskData2.data[i] > 128 ? 255 : 0;
  }
  maskCtx.putImageData(maskData2, 0, 0);

  // 创建前景 canvas
  const fgCanvas = document.createElement('canvas');
  fgCanvas.width = w;
  fgCanvas.height = h;
  const fgCtx = fgCanvas.getContext('2d');
  fgCtx.drawImage(originalImg, 0, 0);
  fgCtx.globalCompositeOperation = 'destination-in';
  fgCtx.drawImage(maskCanvas, 0, 0);

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
