# 怎麼打開這個網站

請使用這個資料夾作為網站專案根目錄：

```bash
stamp-studio-online
```

## 方法 1：本機開發預覽

```bash
cd stamp-studio-online
npm install
npm run dev
```

終端機會出現類似：

```text
Local: http://localhost:5173/
```

把這個網址貼到瀏覽器就能打開網站。

## 方法 2：正式打包後預覽

```bash
cd stamp-studio-online
npm install
npm run build
npm run preview
```

終端機會出現類似：

```text
Local: http://localhost:4173/
```

把這個網址貼到瀏覽器即可。

## 方法 3：Firebase Hosting 上線

```bash
cd stamp-studio-online
npm install
npm run build
firebase deploy
```

這份專案的 `firebase.json` 已經設定部署 `dist` 資料夾。

## 方法 4：Vercel 上線

Vercel 專案設定：

```text
Root Directory: stamp-studio-online
Build Command: npm run build
Output Directory: dist
```

## 這次已修好的地方

1. 原本 Firebase env 放在 `src/env`，Vite 不會自動讀取；已改成專案根目錄 `.env`。
2. 已刪除 `src/env`，避免誤會。
3. `vite.config.js` 已加入 `base: './'`，讓打包後的靜態資源路徑更穩定。
