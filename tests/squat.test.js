import { test } from "node:test";
import assert from "node:assert/strict";
import { angle, kneeAngle, classifyDepth, SquatCounter } from "../frontend/js/squat.js";
import { parseYouTubeId } from "../frontend/js/youtube.js";

test("angle: 直角與直線", () => {
  assert.equal(Math.round(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })), 90);
  assert.equal(Math.round(angle({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 })), 180);
});

test("kneeAngle: 可見度不足回傳 null", () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  assert.equal(kneeAngle(lm), null);
});

test("kneeAngle: 站直約 180 度", () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  lm[23] = { x: 0.5, y: 0.5, visibility: 0.9 };
  lm[25] = { x: 0.5, y: 0.7, visibility: 0.9 };
  lm[27] = { x: 0.5, y: 0.9, visibility: 0.9 };
  assert.ok(kneeAngle(lm) > 175);
});

test("classifyDepth 門檻", () => {
  assert.equal(classifyDepth(130), "shallow");
  assert.equal(classifyDepth(90), "good");
  assert.equal(classifyDepth(60), "deep");
});

function doRep(counter, bottom) {
  let res;
  const seq = [175, 150, 130, 110, bottom, bottom, bottom, bottom, 110, 140, 175, 178, 178, 178];
  for (const a of seq) {
    const r = counter.update(a);
    if (r.repCompleted) res = r.repCompleted;
  }
  return res;
}

test("SquatCounter: 三種深度各計一次", () => {
  const c = new SquatCounter();
  assert.equal(doRep(c, 125), "shallow");
  assert.equal(doRep(c, 90), "good");
  assert.equal(doRep(c, 50), "deep");
  assert.equal(c.reps, 3);
  assert.deepEqual(c.counts, { good: 1, shallow: 1, deep: 1 });
});

test("SquatCounter: 小幅晃動不計次", () => {
  const c = new SquatCounter();
  for (const a of [175, 165, 158, 162, 170, 155, 175]) c.update(a);
  assert.equal(c.reps, 0);
});

test("SquatCounter: 偵測不到時不改變狀態", () => {
  const c = new SquatCounter();
  const r = c.update(null);
  assert.equal(r.angle, null);
  assert.equal(c.reps, 0);
});

test("parseYouTubeId: 各種格式", () => {
  const id = "dQw4w9WgXcQ";
  for (const u of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=30s`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `youtube.com/watch?v=${id}`,
    id,
  ]) assert.equal(parseYouTubeId(u), id, u);
  assert.equal(parseYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parseYouTubeId("hello"), null);
  assert.equal(parseYouTubeId(""), null);
});
