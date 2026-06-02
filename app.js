/**
 * 证件照制作 - 前端版
 * 通过 Vercel 后端代理调用百度 AI API（避免 CORS）
 */

const API_BASE = 'https://id-photo-pwa.vercel.app';

// ===== 状态 =====
let state = {
  file: null,
  color: 'blue',
  width: 295,
  height: 413,
  result: null,
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
      updateProcessBtn();
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
  $('#retryBtn').addEventListener('click', () => {
    resultPage.classList.remove('show');
    state.result = null;
  });
  $('#saveBtn').addEventListener('click', handleSave);
}

function handleFileSelect(e) {
  if (e.target.files.length) handleFile(e.target.files[0]);
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return; }
  if (file.size > 10 * 1024 * 1024) { alert('图片太大，请选择 10MB 以内的图片'); return; }
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

// ===== 处理图片 =====
async function handleProcess() {
  if (!state.file) return;

  processBtn.querySelector('.btn-text').hidden = true;
  processBtn.querySelector('.btn-loading').hidden = false;
  processBtn.disabled = true;

  try {
    const compressedBlob = await compressImage(state.file, 1024 * 1024);
    const base64 = await blobToBase64(compressedBlob);
    const imageBase64 = base64.split(',')[1];

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
          canvas.toBlob((blob) => {
            if (blob.size > maxSize && quality > 0.1) {
              quality -= 0.1;
              tryCompress();
            } else {
              resolve(blob);
            }
          }, 'image/jpeg', quality);
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

document.addEventListener('DOMContentLoaded', init);
