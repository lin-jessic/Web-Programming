# 如何打開網站

## 本機開發版

```bash
cd Web-Programming-main/stamp-studio-online
npm install
npm run dev
```

打開終端機顯示的網址，通常是：

```text
http://localhost:5173/
```

## 正式打包預覽

```bash
cd Web-Programming-main/stamp-studio-online
npm install
npm run build
npm run preview
```

打開終端機顯示的網址，通常是：

```text
http://localhost:4173/
```

## 上線

### Firebase Hosting

```bash
cd Web-Programming-main/stamp-studio-online
npm install
npm run build
firebase deploy
```

### Vercel

設定：

```text
Root Directory: stamp-studio-online
Build Command: npm run build
Output Directory: dist
```
