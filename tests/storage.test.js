import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRecords, addRecord, deleteRecord } from "../frontend/js/storage.js";

function memStore() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
}

test("新增、讀取、刪除紀錄", () => {
  const s = memStore();
  assert.deepEqual(loadRecords(s), []);
  const r = addRecord({ videoTitle: "八段錦", videoId: "abcdefghijk", reps: 5, goodReps: 4, shallowReps: 1 }, s);
  assert.equal(r.reps, 5);
  assert.equal(r.deepReps, 0);
  assert.ok(!Number.isNaN(Date.parse(r.date)));
  assert.equal(loadRecords(s).length, 1);
  assert.equal(deleteRecord(r.id, s), true);
  assert.equal(deleteRecord(r.id, s), false);
  assert.deepEqual(loadRecords(s), []);
});

test("新到舊排序", async () => {
  const s = memStore();
  addRecord({ videoTitle: "A", reps: 1 }, s);
  await new Promise((r) => setTimeout(r, 5));
  addRecord({ videoTitle: "B", reps: 1 }, s);
  assert.deepEqual(loadRecords(s).map((r) => r.videoTitle), ["B", "A"]);
});

test("缺少影片名稱會丟錯；壞掉的資料不會讓頁面掛掉", () => {
  const s = memStore();
  assert.throws(() => addRecord({ reps: 1 }, s));
  s.setItem("exercise-mvp.records.v1", "{壞掉");
  assert.deepEqual(loadRecords(s), []);
});
