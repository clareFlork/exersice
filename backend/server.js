// 運動姿勢矯正平台 — 本機開發伺服器
// 紀錄已改存在使用者瀏覽器（frontend/js/storage.js），這裡只負責在本機提供網頁。
// 正式上線時，frontend 資料夾可直接放到 GitHub Pages 等靜態網站主機，不需要這支伺服器。
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "frontend");

export function createApp() {
  const app = express();
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  // no-cache：瀏覽器每次都會確認檔案是否有更新，避免更新程式後還在跑舊版
  app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
  }));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createApp().listen(PORT, () => {
    console.log(`✅ 伺服器已啟動：http://localhost:${PORT}`);
  });
}
