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

## 架構

```
exercise-mvp/
├── backend/
│   ├── server.js          Express：REST API + 提供前端靜態檔
│   └── data/records.json  紀錄資料（自動建立，免資料庫）
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js         畫面流程：影片、鏡頭、開始/結束、紀錄列表
│       ├── youtube.js     YouTube 連結解析 + IFrame API
│       ├── pose.js        MediaPipe Pose Landmarker（瀏覽器內推論）
│       └── squat.js       深蹲角度計算與計次狀態機（純函式）
└── tests/
```

- **骨架偵測**：Google MediaPipe Pose Landmarker（lite 模型），在瀏覽器以 WebAssembly/WebGL 執行，影像不會上傳到伺服器。
- **深蹲判斷**：取可見度較高一側的「髖-膝-踝」夾角，平滑後進入狀態機：
  角度 < 145° 開始下蹲 → 角度 > 160° 站起來時結算一次，依該次最低角度判斷：
  `> 110°` 太淺｜`70°–110°` 恰好｜`< 70°` 太深。門檻集中在 `squat.js` 的 `THRESHOLDS`，可依實測調整。

## API

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/records` | 取得所有紀錄（新到舊） |
| POST | `/api/records` | 新增紀錄 |
| DELETE | `/api/records/:id` | 刪除紀錄 |
| GET | `/api/health` | 健康檢查 |

POST 內容（`videoTitle`、`reps` 必填；日期由伺服器產生）：

```json
{
  "videoTitle": "10 分鐘深蹲跟練",
  "videoId": "dQw4w9WgXcQ",
  "reps": 15,
  "goodReps": 11,
  "shallowReps": 3,
  "deepReps": 1,
  "durationSec": 600
}
```

環境變數：`PORT`（預設 3000）、`DATA_FILE`（紀錄檔路徑）。

## 驗收對照

| 驗收項目 | 實作 |
|---|---|
| 輸入 YouTube 連結並播放 | 支援 watch / youtu.be / shorts / embed 等格式 |
| 開啟鏡頭 + 骨架疊加 | MediaPipe 33 個關節點畫在鏡頭畫面上，顏色隨判斷結果變化 |
| 單一動作即時提示 | 深蹲：太淺 / 恰好 / 太深，畫面大字 + 選用語音 |
| 運動後自動紀錄 | 日期、影片名稱、完成次數（另附各深度次數與時長） |

## 已知限制（Phase 0）

- 紀錄存在單一 JSON 檔、沒有帳號，所有使用此伺服器的人共用紀錄。下一階段可換成 SQLite / Postgres 並加入登入。
- 正面面對鏡頭時膝蓋角度較不準，建議側身 45°～90°。
- 首次載入需從 CDN 下載模型（約 5 MB），需要網路。
