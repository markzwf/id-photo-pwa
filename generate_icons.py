"""生成 PWA 图标"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    # 创建渐变背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制圆形渐变背景
    for i in range(size):
        ratio = i / size
        r = int(102 * (1 - ratio) + 118 * ratio)
        g = int(126 * (1 - ratio) + 75 * ratio)
        b = int(234 * (1 - ratio) + 162 * ratio)
        draw.ellipse([0, i, size, i+1], fill=(r, g, b, 255))
    
    # 绘制相机图标（简化版）
    center = size // 2
    camera_size = size // 3
    
    # 相机主体
    draw.rounded_rectangle(
        [center - camera_size, center - camera_size//2, 
         center + camera_size, center + camera_size//2],
        radius=size//20,
        fill=(255, 255, 255, 255)
    )
    
    # 镜头
    lens_size = camera_size // 2
    draw.ellipse(
        [center - lens_size, center - lens_size,
         center + lens_size, center + lens_size],
        fill=(102, 126, 234, 255)
    )
    
    img.save(output_path, 'PNG')
    print(f'Generated: {output_path}')

# 生成图标
output_dir = r'D:\open claw\Work Area\id-photo-pwa'
create_icon(192, os.path.join(output_dir, 'icon-192.png'))
create_icon(512, os.path.join(output_dir, 'icon-512.png'))
print('Done!')
