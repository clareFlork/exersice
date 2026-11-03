# 姿勢教練｜運動姿勢矯正平台 Phase 0 MVP

邊看 YouTube 影片邊做深蹲，瀏覽器透過鏡頭即時判斷「太淺 / 恰好 / 太深」，運動結束自動存一筆紀錄。
使用者端只需要瀏覽器，不用安裝任何軟體。

## 快速開始

需要 Node.js 18 以上。

```bash
cd exercise-mvp
npm install      # 會一併安裝 backend 相依套件
npm start        # 啟動於 http://localhost:3000
npm test         # 執行單元測試 + API 測試
```

打開 http://localhost:3000 ：

1. 貼上 YouTube 連結 → 按「載入影片」
2. 按「開啟鏡頭」並允許攝影機權限（側身、全身入鏡效果最好）
3. 按「▶ 開始運動」，影片會自動播放，畫面即時顯示深蹲提示（可開關語音）
4. 按「■ 結束運動」或影片播完 → 自動產生紀錄，出現在下方「運動紀錄」

> 攝影機只能在 `localhost` 或 HTTPS 網址下使用。部署到正式網址時請加上 HTTPS。

## 部署到 GitHub Pages（免費、https、24 小時可用）

網站是純前端，紀錄存在每位使用者自己的瀏覽器，所以只要上傳 `frontend` 資料夾裡的檔案即可：

1. 在 GitHub 建立一個 **Public** repository（例如 `squat-coach`）
2. 進入 repo → Add file → Upload files → 把 `frontend` **裡面的**檔案和資料夾（index.html、css、js）拖進去 → Commit changes
3. Settings → Pages → Source 選 **Deploy from a branch**，Branch 選 **main**、資料夾選 **/ (root)** → Save
4. 等 1～2 分鐘，網址為 `https://你的帳號.github.io/squat-coach/`

之後要更新程式，重複步驟 2 上傳覆蓋即可。

## 架構

```
exercise-mvp/
├── backend/
│   └── server.js          本機開發用伺服器（npm start），正式上線不需要
├── frontend/              ← 正式上線只需要這個資料夾
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js         畫面流程：影片、鏡頭、開始/結束、紀錄列表
│       ├── storage.js     運動紀錄（存在瀏覽器 localStorage）
│       ├── youtube.js     YouTube 連結解析 + IFrame API
│       ├── pose.js        MediaPipe Pose Landmarker（瀏覽器內推論）
│       └── squat.js       深蹲角度計算與計次狀態機（純函式）
└── tests/
```

- **骨架偵測**：Google MediaPipe Pose Landmarker（lite 模型），在瀏覽器以 WebAssembly/WebGL 執行，影像不會上傳。
- **深蹲判斷**：取可見度較高一側的「髖-膝-踝」夾角，平滑後進入狀態機：
  角度 < 145° 開始下蹲 → 角度 > 160° 站起來時結算一次，依該次最低角度判斷：
  `> 110°` 太淺｜`70°–110°` 恰好｜`< 70°` 太深。門檻集中在 `squat.js` 的 `THRESHOLDS`。
- **紀錄**：每人每台裝置各自獨立，不需要帳號或資料庫。

## 已知限制

- 紀錄只存在該瀏覽器：換裝置看不到、清除瀏覽器資料會消失、無痕模式關閉後會消失。
- 正面面對鏡頭時膝蓋角度較不準，建議側身 45°～90°。
- 首次載入需從 CDN 下載模型（約 5 MB），需要網路。
