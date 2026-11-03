import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../backend/server.js";

let server, base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test("提供前端頁面與程式", async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /姿勢教練/);
  for (const f of ["app.js", "storage.js", "squat.js", "youtube.js", "pose.js"]) {
    const r = await fetch(`${base}/js/${f}`);
    assert.equal(r.status, 200, f);
    assert.equal(r.headers.get("cache-control"), "no-cache");
  }
});

test("健康檢查", async () => {
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true });
});
