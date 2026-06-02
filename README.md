# 证件照制作 PWA

上传照片 → 智能抠图 → 一键换底色 → 下载证件照

## 项目结构

```
id-photo-pwa/
├── index.html          # 主页面
├── style.css           # 样式
├── app.js              # 前端逻辑
├── sw.js               # Service Worker（离线缓存）
├── manifest.json       # PWA 配置
├── api/
│   └── process.js      # Vercel Serverless Function
├── vercel.json         # Vercel 部署配置
└── package.json
```

## 部署到 Vercel（免费）

### 方法一：命令行部署

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录（会打开浏览器）
vercel login

# 3. 在项目目录执行部署
cd id-photo-pwa
vercel

# 4. 部署到生产环境
vercel --prod
```

### 方法二：GitHub 部署

1. 把代码推到 GitHub 仓库
2. 访问 https://vercel.com
3. 点击「Import Project」
4. 选择 GitHub 仓库
5. 点击 Deploy

### 配置环境变量（可选）

在 Vercel 项目设置中添加：
- `BAIDU_API_KEY` = 你的百度 API Key
- `BAIDU_SECRET_KEY` = 你的百度 Secret Key

（代码中已内置 Key，不配置也能用）

## 使用方法

1. 手机打开部署后的链接
2. 上传照片
3. 选择底色（蓝/红/白/绿）
4. 选择尺寸（一寸/二寸/签证等）
5. 点击「开始处理」
6. 保存到手机

## 添加到桌面（像 APP 一样使用）

### iOS Safari
1. 打开链接
2. 点击底部「分享」按钮
3. 选择「添加到主屏幕」

### Android Chrome
1. 打开链接
2. 点击右上角「⋮」菜单
3. 选择「添加到主屏幕」
