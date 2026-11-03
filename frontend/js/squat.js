// 深蹲偵測核心邏輯（純函式，不依賴瀏覽器，可單元測試）
// MediaPipe Pose 關節編號：左髖 23、左膝 25、左踝 27；右髖 24、右膝 26、右踝 28

export const LM = { L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28 };

// 角度門檻（膝關節角度：髖-膝-踝，站直約 170~180 度）
export const THRESHOLDS = {
  STAND: 160,   // 大於此角度視為站立
  START: 145,   // 小於此角度視為開始下蹲
  SHALLOW: 110, // 最低點角度 > 110 → 太淺
  DEEP: 70,     // 最低點角度 < 70  → 太深；介於 70~110 → 恰好
  MIN_VIS: 0.5, // 關節點可見度門檻
};

/** 計算 b 點的夾角（a-b-c），回傳 0~180 度 */
export function angle(a, b, c) {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return NaN;
  const cos = Math.min(1, Math.max(-1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** 從 33 個關節點中挑可見度較高的一側，算出膝蓋角度；看不清楚回傳 null */
export function kneeAngle(landmarks) {
  if (!landmarks || landmarks.length < 29) return null;
  const side = (h, k, a) => {
    const pts = [landmarks[h], landmarks[k], landmarks[a]];
    const vis = Math.min(...pts.map((p) => p.visibility ?? 1));
    return { vis, ang: angle(pts[0], pts[1], pts[2]) };
  };
  const l = side(LM.L_HIP, LM.L_KNEE, LM.L_ANKLE);
  const r = side(LM.R_HIP, LM.R_KNEE, LM.R_ANKLE);
  const best = l.vis >= r.vis ? l : r;
  if (best.vis < THRESHOLDS.MIN_VIS || Number.isNaN(best.ang)) return null;
  return best.ang;
}

/** 依角度判斷深度 */
export function classifyDepth(minAngle) {
  if (minAngle > THRESHOLDS.SHALLOW) return "shallow";
  if (minAngle < THRESHOLDS.DEEP) return "deep";
  return "good";
}

export const DEPTH_LABEL = { shallow: "太淺", good: "恰好", deep: "太深" };

/**
 * 深蹲計數器（狀態機）
 * standing → (角度 < START) → down → (角度 > STAND) → standing 並結算一次
 */
export class SquatCounter {
  constructor() { this.reset(); }

  reset() {
    this.state = "standing";
    this.minAngle = 180;
    this.reps = 0;
    this.counts = { good: 0, shallow: 0, deep: 0 };
    this.lastRep = null;
    this.smoothed = null;
  }

  /**
   * 輸入一幀的膝蓋角度，回傳即時狀態
   * @returns {{angle:number|null, state:string, live:string|null, repCompleted:string|null}}
   */
  update(rawAngle) {
    if (rawAngle == null) {
      return { angle: null, state: this.state, live: null, repCompleted: null };
    }
    // 指數平滑，降低抖動
    this.smoothed = this.smoothed == null ? rawAngle : this.smoothed * 0.6 + rawAngle * 0.4;
    const a = this.smoothed;
    let repCompleted = null;

    if (this.state === "standing") {
      if (a < THRESHOLDS.START) {
        this.state = "down";
        this.minAngle = a;
      }
    } else {
      this.minAngle = Math.min(this.minAngle, a);
      if (a > THRESHOLDS.STAND) {
        repCompleted = classifyDepth(this.minAngle);
        this.reps += 1;
        this.counts[repCompleted] += 1;
        this.lastRep = repCompleted;
        this.state = "standing";
        this.minAngle = 180;
      }
    }

    // 下蹲中：依目前最低點給即時提示
    const live = this.state === "down" ? classifyDepth(this.minAngle) : null;
    return { angle: a, state: this.state, live, repCompleted };
  }
}
