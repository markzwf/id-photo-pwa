const { createCanvas } = require('canvas');
const fs = require('fs');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();

  // 相机图标
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📸', size/2, size/2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`Generated: ${filename}`);
}

generateIcon(192, 'D:\\open claw\\Work Area\\id-photo-pwa\\icon-192.png');
generateIcon(512, 'D:\\open claw\\Work Area\\id-photo-pwa\\icon-512.png');
