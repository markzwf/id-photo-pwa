/**
 * 证件照制作 - 前端逻辑
 * 纯前端方案：调用 Vercel Serverless Function 处理图片
 */

// ===== 配置 =====
const API_BASE = window.location.origin; // 同源部署时自动使用当前域名
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
};

// ===== DOM 元素 =====
const $ = (sel) => document.querySelector(sel);
const uploadArea = $('#uploadArea');
const fileInput = $('#fileInput');
const preview = $('#preview');
const uploadContent = $('#uploadContent');
const processBtn = $('#processBtn');
const resultPage = $('#resultPage');
const resultImg = $('#resultImg');
const backBtn = $('#backBtn');
const saveBtn = $('#saveBtn');
const retryBtn = $('#retryBtn');

// ===== 初始化 =====
function init() {
  // 文件选择
  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // 拖拽
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setFile(file);
    }
  });

  // 颜色选择
  document.querySelectorAll('.color-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.color = btn.dataset.color;
    });
  });

  // 尺寸选择
  document.querySelectorAll('.size-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.width = parseInt(btn.dataset.w);
      state.height = parseInt(btn.dataset.h);
    });
  });

  // 处理按钮
  processBtn.addEventListener('click', handleProcess);

  // 返回按钮
  backBtn.addEventListener('click', () => {
    resultPage.classList.remove('show');
  });

  // 保存按钮
  saveBtn.addEventListener('click', handleSave);

  // 重试按钮
  retryBtn.addEventListener('click', () => {
    resultPage.classList.remove('show');
    state.file = null;
    state.result = null;
    preview.style.display = 'none';
    uploadContent.style.display = 'block';
    uploadArea.classList.remove('has-image');
    processBtn.disabled = true;
  });

  // 注册 Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ===== 文件处理 =====
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  state.file = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    uploadContent.style.display = 'none';
    uploadArea.classList.add('has-image');
    processBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

// ===== 核心处理 =====
async function handleProcess() {
  if (!state.file) return;

  // 显示加载
  processBtn.querySelector('.btn-text').hidden = true;
  processBtn.querySelector('.btn-loading').hidden = false;
  processBtn.disabled = true;

  try {
    // 压缩图片到合理大小（百度API限制）
    const compressedBlob = await compressImage(state.file, 1024 * 1024); // 1MB
    const base64 = await blobToBase64(compressedBlob);
    const imageBase64 = base64.split(',')[1]; // 去掉 data:image/xxx;base64, 前缀

    // 调用后端 API
    const response = await fetch(`${API_BASE}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64,
        color: state.color,
        width: state.width,
        height: state.height,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || '处理失败');
    }

    const result = await response.json();

    if (result.success) {
      state.result = result.dataUrl;
      resultImg.src = result.dataUrl;
      resultPage.classList.add('show');
    } else {
      throw new Error(result.message || '处理失败');
    }
  } catch (err) {
    alert('处理失败：' + err.message);
  } finally {
    processBtn.querySelector('.btn-text').hidden = false;
    processBtn.querySelector('.btn-loading').hidden = true;
    processBtn.disabled = false;
  }
}

// ===== 保存图片 =====
function handleSave() {
  if (!state.result) return;

  const link = document.createElement('a');
  link.download = `证件照_${Date.now()}.png`;
  link.href = state.result;

  // 移动端兼容
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    // 移动端：打开新窗口让用户长按保存
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

        // 限制最大尺寸
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

        // 逐步压缩到目标大小
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
