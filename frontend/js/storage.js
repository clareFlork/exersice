// 運動紀錄存在使用者自己的瀏覽器（localStorage）
// 每個人、每台裝置的紀錄各自獨立；清除瀏覽器資料會一併清除紀錄。

const KEY = "exercise-mvp.records.v1";

function getStore(store) {
  if (store) return store;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // 部分隱私模式會直接丟出錯誤
  }
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

const toInt = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

/** 讀取所有紀錄（新到舊） */
export function loadRecords(store) {
  const s = getStore(store);
  if (!s) return [];
  try {
    const data = JSON.parse(s.getItem(KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch {
    return [];
  }
}

function save(records, store) {
  const s = getStore(store);
  if (!s) throw new Error("此瀏覽器無法儲存資料（可能是無痕模式）");
  s.setItem(KEY, JSON.stringify(records));
}

/** 新增一筆紀錄，回傳完整紀錄 */
export function addRecord(input, store) {
  const videoTitle = String(input?.videoTitle ?? "").trim().slice(0, 300);
  if (!videoTitle) throw new Error("缺少影片名稱");
  const record = {
    id: newId(),
    date: new Date().toISOString(),
    videoTitle,
    videoId: typeof input.videoId === "string" ? input.videoId.slice(0, 20) : "",
    exercise: "squat",
    reps: toInt(input.reps),
    goodReps: toInt(input.goodReps),
    shallowReps: toInt(input.shallowReps),
    deepReps: toInt(input.deepReps),
    durationSec: toInt(input.durationSec),
  };
  save([...loadRecords(store), record], store);
  return record;
}

/** 刪除一筆紀錄，回傳是否有刪到 */
export function deleteRecord(id, store) {
  const records = loadRecords(store);
  const next = records.filter((r) => r.id !== id);
  if (next.length === records.length) return false;
  save(next, store);
  return true;
}
