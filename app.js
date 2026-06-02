/**
 * 证件照制作 - 纯前端版
 * 使用 TensorFlow.js + BodyPix 在浏览器端抠图，无需后端
 */

// ===== 状态 =====
let state = {
  file: null,
  color: '#438edb',
  width: 295,
  height: 413,
  result: null,
};

let net = null; // BodyPix 模型

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const uploadArea = $('#uploadArea');
const fileInput = $('#fileInput');
const preview = $('#preview');
const uploadContent = $('#uploadContent');
const processBtn = $('#processBtn');
const resultPage = $('#resultPage');
const resultImg = $('#resultImg');
const modelStatus = $('#modelStatus');

// ===== 初始化 =====
async function init() {
  // 加载 BodyPix 模型
  try {
    net = await bodyPix.load({
      multiplier: 0.75, // 较小模型，速度快
      quantBytes: 2,
    });
    modelStatus.innerHTML = '✅ AI模型已就绪';
    modelStatus.style.color = '#28a745';
    processBtn.disabled = false;
  } catch (err) {
    modelStatus.innerHTML = '❌ 模型加载失败，请刷新重试';
    modelStatus.style.color = '#dc3545';
    console.error('Model load error:', err);
  }

  // 上传事件
  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  // 底色
  document.querySelectorAll('.color-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector('.color-item.active').classList.remove('active');
      btn.classList.add('active');
      state.color = btn.dataset.color;
    });
  });

  // 尺寸
  document.querySelectorAll('.size-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector('.size-item.active').classList.remove('active');
      btn.classList.add('active');
      state.width = parseInt(btn.dataset.w);
      state.height = parseInt(btn.dataset.h);
    });
  });

  // 处理
  processBtn.addEventListener('click', handleProcess);

  // 返回/重试/保存
  $('#backBtn').addEventListener('click', () => resultPage.classList.remove('show'));
  $('#retryBtn').addEventListener('click', () => {
    resultPage.classList.remove('show');
    state.result = null;
  });
  $('#saveBtn').addEventListener('click', handleSave);
}

// ===== 文件选择 =====
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

// ===== 处理图片 =====
async function handleProcess() {
  if (!state.file || !net) return;

  processBtn.querySelector('.btn-text').hidden = true;
  processBtn.querySelector('.btn-loading').hidden = false;
  processBtn.disabled = true;

  try {
    // 1. 加载图片到 canvas
    const img = await loadImage(state.file);

    // 2. 人像分割
    const segmentation = await net.segmentPerson(img, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7,
      flipHorizontal: false,
    });

    // 3. 提取前景 + 合成背景
    const dataUrl = compositeImage(img, segmentation, state.color, state.width, state.height);

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

// ===== 加载图片 =====
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ===== 合成证件照 =====
function compositeImage(originalImg, segmentation, bgColor, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  // 1. 画背景色
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 2. 创建前景 mask
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = segmentation.width;
  maskCanvas.height = segmentation.height;
  const maskCtx = maskCanvas.getContext('2d');
  const maskData = maskCtx.createImageData(segmentation.width, segmentation.height);

  for (let i = 0; i < segmentation.data.length; i++) {
    if (segmentation.data[i] === 1) {
      // 人物像素
      maskData.data[i * 4] = 255;     // R
      maskData.data[i * 4 + 1] = 255; // G
      maskData.data[i * 4 + 2] = 255; // B
      maskData.data[i * 4 + 3] = 255; // A
    } else {
      // 背景像素 - 透明
      maskData.data[i * 4 + 3] = 0;
    }
  }
  maskCtx.putImageData(maskData, 0, 0);

  // 3. 创建前景 canvas（原图 + mask）
  const fgCanvas = document.createElement('canvas');
  fgCanvas.width = originalImg.width;
  fgCanvas.height = originalImg.height;
  const fgCtx = fgCanvas.getContext('2d');
  fgCtx.drawImage(originalImg, 0, 0);
  fgCtx.globalCompositeOperation = 'destination-in';
  fgCtx.drawImage(maskCanvas, 0, 0, originalImg.width, originalImg.height);

  // 4. 计算前景尺寸（居中，留 5% 边距）
  const padding = 0.08;
  const maxW = targetWidth * (1 - padding * 2);
  const maxH = targetHeight * (1 - padding * 2);
  const scale = Math.min(maxW / originalImg.width, maxH / originalImg.height);
  const newW = originalImg.width * scale;
  const newH = originalImg.height * scale;
  const x = (targetWidth - newW) / 2;
  const y = (targetHeight - newH) / 2;

  // 5. 画前景
  ctx.drawImage(fgCanvas, x, y, newW, newH);

  return canvas.toDataURL('image/png');
}

// ===== 保存图片 =====
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
