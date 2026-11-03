import { parseYouTubeId, loadYouTubeApi } from "./youtube.js";
import { createPoseDetector } from "./pose.js";
import { SquatCounter, kneeAngle, DEPTH_LABEL } from "./squat.js";
import { loadRecords, addRecord, deleteRecord } from "./storage.js";

const $ = (id) => document.getElementById(id);
const el = {
  url: $("yt-url"), loadBtn: $("load-btn"), urlError: $("url-error"),
  cameraBtn: $("camera-btn"), startBtn: $("start-btn"), endBtn: $("end-btn"),
  video: $("cam"), canvas: $("overlay"), camPlaceholder: $("cam-placeholder"),
  hint: $("hint"), hintSub: $("hint-sub"), reps: $("reps"), good: $("good"),
  shallow: $("shallow"), deep: $("deep"), angle: $("angle"), timer: $("timer"),
  voice: $("voice"), history: $("history"), toast: $("toast"),
};
const ctx = el.canvas.getContext("2d");

const state = {
  player: null, videoId: null, detector: null, stream: null,
  counter: new SquatCounter(), active: false, startedAt: 0, timerId: null,
  lastSeenAt: 0,
};

// ---------- 小工具 ----------
function toast(msg, ms = 2500) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.toast.hidden = true), ms);
}

function speak(text) {
  if (!el.voice.checked || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-TW";
  u.rate = 1.1;
  speechSynthesis.speak(u);
}

function setHint(kind, text, sub = "") {
  el.hint.className = `hint hint-${kind}`;
  el.hint.textContent = text;
  el.hintSub.textContent = sub;
}

const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function renderStats() {
  const c = state.counter;
  el.reps.textContent = c.reps;
  el.good.textContent = c.counts.good;
  el.shallow.textContent = c.counts.shallow;
  el.deep.textContent = c.counts.deep;
}

function updateButtons() {
  el.startBtn.disabled = state.active || !state.player || !state.detector;
  el.endBtn.disabled = !state.active;
  el.startBtn.title = !state.player ? "請先載入影片" : !state.detector ? "請先開啟鏡頭" : "";
}

// ---------- 1. 影片播放 ----------
async function loadVideo() {
  const id = parseYouTubeId(el.url.value);
  if (!id) {
    el.urlError.textContent = "無法辨識的 YouTube 連結，請確認後再試一次。";
    return;
  }
  el.urlError.textContent = "";
  state.videoId = id;
  el.loadBtn.disabled = true;
  try {
    const YT = await loadYouTubeApi();
    if (state.player) {
      state.player.cueVideoById(id);
    } else {
      await new Promise((resolve) => {
        state.player = new YT.Player("player", {
          videoId: id,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: resolve,
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.ENDED && state.active) endWorkout("影片播放完畢");
            },
          },
        });
      });
    }
    document.querySelector(".player-wrap").classList.add("loaded");
    toast("影片已載入");
  } catch (err) {
    el.urlError.textContent = err.message;
  } finally {
    el.loadBtn.disabled = false;
    updateButtons();
  }
}

// ---------- 2. 攝影機 & 骨架偵測 ----------
async function startCamera() {
  if (state.stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("此瀏覽器不支援攝影機，請改用最新版 Chrome / Edge / Firefox", 4000);
    return;
  }
  el.cameraBtn.disabled = true;
  el.cameraBtn.textContent = "啟動中…";
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    el.video.srcObject = state.stream;
    await el.video.play();
    el.camPlaceholder.hidden = true;
    setHint("idle", "載入姿勢模型中…", "第一次約需數秒");
    state.detector = await createPoseDetector();
    setHint("idle", "準備就緒", "請退後讓全身（至少髖、膝、腳踝）入鏡，側身效果最好");
    el.cameraBtn.textContent = "鏡頭已開啟";
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    const msg = err.name === "NotAllowedError" ? "攝影機權限被拒絕，請在網址列允許鏡頭後重試。" : `無法開啟鏡頭：${err.message}`;
    toast(msg, 5000);
    el.cameraBtn.disabled = false;
    el.cameraBtn.textContent = "開啟鏡頭";
    state.stream?.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  updateButtons();
}

let lastVideoTime = -1;
function loop() {
  if (!state.stream) return;
  const v = el.video;
  if (v.readyState >= 2 && v.currentTime !== lastVideoTime) {
    lastVideoTime = v.currentTime;
    if (el.canvas.width !== v.videoWidth) {
      el.canvas.width = v.videoWidth;
      el.canvas.height = v.videoHeight;
    }
    const landmarks = state.detector.detect(v, performance.now());
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    if (landmarks) {
      state.lastSeenAt = performance.now();
      onLandmarks(landmarks);
    } else if (performance.now() - state.lastSeenAt > 1000) {
      el.angle.textContent = "--";
      if (state.active) setHint("warn", "看不到你", "請讓全身進入畫面");
    }
  }
  requestAnimationFrame(loop);
}

// ---------- 3. 深蹲偵測 & 即時提示 ----------
const COLORS = { good: "#22c55e", shallow: "#f59e0b", deep: "#ef4444", none: "#38bdf8" };

function onLandmarks(landmarks) {
  const ang = kneeAngle(landmarks);
  el.angle.textContent = ang == null ? "--" : `${Math.round(ang)}°`;

  if (!state.active) {
    state.detector.draw(ctx, landmarks, COLORS.none);
    return;
  }

  const r = state.counter.update(ang);
  state.detector.draw(ctx, landmarks, COLORS[r.live || state.counter.lastRep || "none"]);

  if (ang == null) {
    setHint("warn", "看不清楚下半身", "請讓髖、膝、腳踝都入鏡");
    return;
  }
  if (r.repCompleted) {
    const label = DEPTH_LABEL[r.repCompleted];
    setHint(r.repCompleted, label, `第 ${state.counter.reps} 下完成`);
    speak(`${state.counter.reps}，${label}`);
    renderStats();
  } else if (r.live) {
    const sub = { shallow: "再往下蹲一點", good: "很好，保持！可以站起來了", deep: "蹲太低了，注意膝蓋" }[r.live];
    setHint(r.live, DEPTH_LABEL[r.live], sub);
  }
}

// ---------- 運動開始 / 結束 ----------
function startWorkout() {
  state.counter.reset();
  renderStats();
  state.active = true;
  state.startedAt = Date.now();
  el.timer.textContent = "00:00";
  state.timerId = setInterval(() => {
    el.timer.textContent = fmtTime(Math.floor((Date.now() - state.startedAt) / 1000));
  }, 500);
  setHint("idle", "開始！", "跟著影片做深蹲");
  speak("開始");
  state.player?.playVideo();
  updateButtons();
}

// ---------- 4. 基本紀錄 ----------
async function endWorkout(reason = "") {
  if (!state.active) return;
  state.active = false;
  clearInterval(state.timerId);
  state.player?.pauseVideo?.();
  updateButtons();

  const c = state.counter;
  const title = state.player?.getVideoData?.().title || `YouTube 影片 ${state.videoId}`;
  const body = {
    videoTitle: title,
    videoId: state.videoId,
    reps: c.reps,
    goodReps: c.counts.good,
    shallowReps: c.counts.shallow,
    deepReps: c.counts.deep,
    durationSec: Math.floor((Date.now() - state.startedAt) / 1000),
  };
  setHint("idle", "運動結束", `${reason ? reason + "，" : ""}共完成 ${c.reps} 下`);
  speak(`運動結束，共完成 ${c.reps} 下`);

  try {
    addRecord(body);
    toast("✅ 已儲存本次紀錄");
    loadHistory();
  } catch (err) {
    toast(`紀錄儲存失敗：${err.message}`, 5000);
  }
}

function loadHistory() {
  const records = loadRecords();
  if (!records.length) {
    el.history.innerHTML = `<li class="empty">還沒有紀錄，完成一次運動就會出現在這裡。</li>`;
    return;
  }
  const n = (v) => Number(v) || 0;
  el.history.innerHTML = records
    .map((r) => {
      const d = new Date(r.date);
      const date = d.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
      const time = d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
      return `<li>
        <div class="rec-main">
          <div class="rec-title">${escapeHtml(r.videoTitle)}</div>
          <div class="rec-meta">${date} ${time} · ${fmtTime(n(r.durationSec))}</div>
        </div>
        <div class="rec-reps"><strong>${n(r.reps)}</strong> 下
          <span class="rec-break">恰好 ${n(r.goodReps)} · 太淺 ${n(r.shallowReps)} · 太深 ${n(r.deepReps)}</span>
        </div>
        ${r.videoId ? `<button class="btn btn-replay" data-replay="${escapeHtml(r.videoId)}">↻ 再練一次</button>` : ""}
        <button class="icon-btn" data-del="${escapeHtml(r.id)}" aria-label="刪除紀錄">✕</button>
      </li>`;
    })
    .join("");
}

async function replay(videoId) {
  if (state.active) {
    toast("請先結束目前的運動，再選擇其他影片");
    return;
  }
  el.url.value = `https://www.youtube.com/watch?v=${videoId}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  await loadVideo();
  if (!state.detector) toast("影片已載入，請按「開啟鏡頭」後再按「開始運動」", 4000);
  else toast("影片已載入，按「▶ 開始運動」即可開始", 3000);
}

el.history.addEventListener("click", async (e) => {
  const replayId = e.target.closest("[data-replay]")?.dataset.replay;
  if (replayId) return replay(replayId);
  const id = e.target.closest("[data-del]")?.dataset.del;
  if (!id || !confirm("確定刪除這筆紀錄？")) return;
  try {
    deleteRecord(id);
  } catch (err) {
    toast(`刪除失敗：${err.message}`, 4000);
  }
  loadHistory();
});

// ---------- 綁定事件 ----------
el.loadBtn.addEventListener("click", loadVideo);
el.url.addEventListener("keydown", (e) => e.key === "Enter" && loadVideo());
el.cameraBtn.addEventListener("click", startCamera);
el.startBtn.addEventListener("click", startWorkout);
el.endBtn.addEventListener("click", () => endWorkout());
window.addEventListener("beforeunload", (e) => {
  if (state.active) { e.preventDefault(); e.returnValue = ""; }
});

updateButtons();
loadHistory();
