/**
 * 证件照制作 - 纯前端版
 * 直接调用百度 AI API，无需后端服务器
 */

// ===== 百度 API 配置 =====
const BAIDU_API_KEY = '1F08Xlc4pgkNnDRgahRRg5Tu';
const BAIDU_SECRET_KEY = 'QE1mtstUH6PnrL8QSI5z4kOAXGPzG16U';
const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_SEG_URL = 'https://aip.baidubce.com/rest/2.0/image-classify/v1/body_seg';

const COLOR_MAP = {
  blue: [67, 142, 219],
  red: [212, 35, 42],
  white: [255, 255, 255],
  green: [0, 166, 81],
};

// ===== 状态 =====
let state = {
  file: null,
  color: 'blue',
  width: 295,
  height: 413,
  result: null,
  accessToken: null,
};

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const uploadArea = $('#uploadArea');
const fileInput = $('#fileInput');
const preview = $('#preview');
const uploadContent = $('#uploadContent');
const processBtn = $('#processBtn');
const resultPage = $('#resultPage');
const resultImg = $('#resultImg');

// ===== 初始化 =====
function init() {
  // 上传
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
      updateProcessBtn();
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

  // 返回
  $('#backBtn').addEventListener('click', () => resultPage.classList.remove('show'));
  $('#retryBtn').addEventListener('click', () => {
    resultPage.classList.remove('show');
    state.result = null;
  });

  // 保存
  $('#saveBtn').addEventListener('click', handleSave);
}

// ===== 文件选择 =====
function handleFileSelect(e) {
  if (e.target.files.length) handleFile(e.target.files[0]);
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('图片太大，请选择 10MB 以内的图片');
    return;
  }
  state.file = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    uploadContent.style.display = 'none';
    uploadArea.style.border = '2px solid #667eea';
  };
  reader.readAsDataURL(file);
  updateProcessBtn();
}

function updateProcessBtn() {
  processBtn.disabled = !state.file;
}

// ===== 获取百度 Access Token =====
async function getAccessToken() {
  if (state.accessToken) return state.accessToken;

  const url = `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`;
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();

  if (!data.access_token) {
    throw new Error('获取百度 Token 失败：' + (data.error_description || '未知错误'));
  }

  state.accessToken = data.access_token;
  return data.access_token;
}

// ===== 百度人像分割 =====
async function segmentPerson(imageBase64) {
  const token = await getAccessToken();
  const url = `${BAIDU_SEG_URL}?access_token=${token}`;

  const body = `image=${encodeURIComponent(imageBase64)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body,
  });

  const data = await res.json();

  if (data.foreground) {
    return data.foreground; // base64 string
  }

  throw new Error('百度分割失败：' + (data.error_msg || '未知错误'));
}

// ===== 处理图片 =====
async function handleProcess() {
  if (!state.file) return;

  processBtn.querySelector('.btn-text').hidden = true;
  processBtn.querySelector('.btn-loading').hidden = false;
  processBtn.disabled = true;

  try {
    // 压缩图片
    const compressedBlob = await compressImage(state.file, 1024 * 1024);
    const base64 = await blobToBase64(compressedBlob);
    const imageBase64 = base64.split(',')[1];

    // 调用百度 API 抠图
    const foregroundBase64 = await segmentPerson(imageBase64);

    // 合成证件照
    const dataUrl = await compositeImage(foregroundBase64, state.color, state.width, state.height);

    state.result = dataUrl;
    resultImg.src = dataUrl;
    resultPage.classList.add('show');
  } catch (err) {
    alert('处理失败：' + err.message);
  } finally {
    processBtn.querySelector('.btn-text').hidden = false;
    processBtn.querySelector('.btn-loading').hidden = true;
    processBtn.disabled = false;
  }
}

// ===== Canvas 合成证件照 =====
function compositeImage(foregroundBase64, bgColor, targetWidth, targetHeight) {
  return new Promise((resolve, reject) => {
    const fgImg = new Image();
    fgImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      // 画背景色
      const rgb = COLOR_MAP[bgColor] || COLOR_MAP.blue;
      ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // 计算前景位置（居中，留 5% 边距）
      const padding = 0.05;
      const maxW = targetWidth * (1 - padding * 2);
      const maxH = targetHeight * (1 - padding * 2);
      const scale = Math.min(maxW / fgImg.width, maxH / fgImg.height);
      const newW = fgImg.width * scale;
      const newH = fgImg.height * scale;
      const x = (targetWidth - newW) / 2;
      const y = (targetHeight - newH) / 2;

      // 画前景
      ctx.drawImage(fgImg, x, y, newW, newH);

      resolve(canvas.toDataURL('image/png'));
    };
    fgImg.onerror = () => reject(new Error('前景图加载失败'));
    fgImg.src = `data:image/png;base64,${foregroundBase64}`;
  });
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

// ===== 工具函数 =====
function compressImage(file, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 2000;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (blob.size > maxSize && quality > 0.1) {
                quality -= 0.1;
                tryCompress();
              } else {
                resolve(blob);
              }
            },
            'image/jpeg',
            quality
          );
        };
        tryCompress();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', init);
