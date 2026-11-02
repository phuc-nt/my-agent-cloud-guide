// Lifecycle simulator: a packet walks the stations, the container sleeps and wakes, a meter bills awake time.
// Time is compressed: work runs at ~8 simulated seconds per real second, the 15-minute idle window at ~75x.
(() => {
  const $ = (id) => document.getElementById(id);
  const stage = $("sim-stage");
  if (!stage) return;
  const packet = $("packet"), plabel = $("packet-label"), log = $("sim-log"), box = $("st-box");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  const PRICE_PER_S = 0.074 / 3600;
  const WORK = 8 / 1000;        // simulated seconds per real ms while work happens
  const IDLE = 900 / 12000;     // the 15-minute idle window plays in about 12 s
  const SLEEP_AFTER = 900;
  const COLD = 15, RESUME = 17.7, SNAPSHOT = 1.35;
  const STATES = { sleeping: "ngủ", waking: "đang thức dậy", ready: "sẵn sàng", running: "đang chạy", stopping: "đang tắt" };
  const STATUS = {
    sleeping: "Container đang ngủ, không tốn compute",
    waking: "Đang restore snapshot và khởi động engine",
    ready: "Sẵn sàng, chờ request tiếp theo",
    running: "Engine đang chạy turn",
    stopping: "Đẩy snapshot cuối rồi dừng"
  };

  let s;            // simulation state, rebuilt on reset
  let gen = 0;      // bumps on reset so a running scenario stops at its next await
  const CANCEL = Symbol("cancel");

  function fresh() {
    return { t: 0, awake: 0, state: "sleeping", busy: false, idle: null, pending: 0, rate: 0, waiters: [] };
  }

  // ---- clock ----
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    let rate = s.rate;
    if (!s.busy && s.idle !== null) rate = IDLE;
    if (rate) advance(dt * rate);
    requestAnimationFrame(frame);
  }
  function advance(sec) {
    s.t += sec;
    if (s.state !== "sleeping") s.awake += sec;
    if (s.idle !== null && !s.busy) {
      s.idle -= sec;
      if (s.idle <= 0) { s.idle = null; run(sleepNow, true); }
    }
    s.waiters = s.waiters.filter((w) => (s.t >= w.until ? (w.done(), false) : true));
    paint();
  }
  function wait(sec) {
    const g = gen;
    return new Promise((done, fail) => {
      s.rate = WORK;
      s.waiters.push({ until: s.t + sec, done: () => { s.rate = 0; g === gen ? done() : fail(CANCEL); } });
    });
  }
  const pause = (ms) => new Promise((r) => setTimeout(r, reduce.matches ? Math.min(ms, 120) : ms));

  // ---- painting ----
  const mmss = (sec) => {
    const m = Math.floor(sec / 60), x = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
  };
  function paint() {
    $("m-clock").textContent = mmss(s.t);
    $("m-awake").textContent = s.awake < 90 ? `${Math.round(s.awake)} s` : `${(s.awake / 60).toFixed(1).replace(".", ",")} phút`;
    $("m-cost").textContent = `$${(s.awake * PRICE_PER_S).toFixed(4)}`;
    $("m-wait").textContent = String(s.pending);
    const idle = $("idle");
    idle.hidden = s.idle === null;
    if (s.idle !== null) {
      $("idle-left").textContent = mmss(Math.max(0, s.idle));
      $("idle-bar").style.width = `${(1 - s.idle / SLEEP_AFTER) * 100}%`;
    }
    $("sim-approve").disabled = s.busy || s.pending === 0;
    document.querySelectorAll("[data-scenario]").forEach((b) => (b.disabled = s.busy));
    $("sim-sleep").disabled = s.busy || s.state === "sleeping";
  }
  function setState(st) {
    s.state = st;
    box.dataset.state = st;
    $("st-state").textContent = STATES[st];
    $("sim-status").textContent = STATUS[st];
    paint();
  }
  function say(text, kind = "") {
    const empty = log.querySelector(".empty");
    if (empty) empty.remove();
    const li = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = mmss(s.t);
    const span = document.createElement("span");
    if (kind) span.className = `k-${kind}`;
    span.textContent = text;
    li.append(time, span);
    log.append(li);
    log.scrollTop = log.scrollHeight;
  }

  // ---- packet ----
  function center(id) {
    const r = $(id).getBoundingClientRect(), o = stage.getBoundingClientRect();
    return [r.left - o.left + r.width / 2, r.top - o.top + r.height / 2];
  }
  async function hop(path, label) {
    const g = gen;
    for (let i = 0; i < path.length - 1; i++) {
      const [x1, y1] = center(`st-${path[i]}`), [x2, y2] = center(`st-${path[i + 1]}`);
      const ms = reduce.matches ? 1 : 560;
      const from = { transform: `translate(${x1}px, ${y1}px)`, opacity: 1 };
      const to = { transform: `translate(${x2}px, ${y2}px)`, opacity: 1 };
      plabel.textContent = label || "";
      const opts = { duration: ms, easing: "cubic-bezier(.45,.05,.35,1)", fill: "forwards" };
      const a = packet.animate([from, to], opts);
      plabel.animate([{ ...from, opacity: label ? 1 : 0 }, { ...to, opacity: label ? 1 : 0 }], opts);
      try { await a.finished; } catch (e) { throw CANCEL; }  // reset cancels the animation
      if (g !== gen) throw CANCEL;
      advance(0.2);
      const hit = $(`st-${path[i + 1]}`);
      hit.classList.add("is-hit");
      setTimeout(() => hit.classList.remove("is-hit"), 700);
      await pause(140);
      if (g !== gen) throw CANCEL;
    }
    packet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce.matches ? 1 : 200, fill: "forwards" });
    plabel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce.matches ? 1 : 200, fill: "forwards" });
  }

  // ---- building blocks ----
  async function ensureAwake(resume) {
    if (s.state !== "sleeping") {
      say("Container đang thức: chuyển tiếp ngay, không có cold start.");
      return;
    }
    say("Container đang ngủ → Durable Object start container.", "wake");
    setState("waking");
    await hop(["do", "box"], "start");
    await hop(["r2", "box"], "snapshot");
    say("Sidecar restore snapshot home từ R2, rồi mở engine.", "wake");
    await wait(COLD);
    say(`Engine sẵn sàng sau ${COLD} s (đo: 12–26 s).`, "ok");
    if (resume) {
      await wait(RESUME - COLD);
      say("Engine đọc run awaiting_approval từ SQLite đã restore.", "ok");
    }
    setState("ready");
  }
  async function modelRound(note) {
    await hop(["box", "model"], "prompt");
    await wait(2);
    if (note) say(note);
    await hop(["model", "box"], "tool call");
    await wait(1.5);
    await hop(["box", "model"], "tool result");
    await wait(2);
    await hop(["model", "box"], "trả lời");
  }
  async function sleepNow(auto) {
    setState("stopping");
    say(auto ? "15 phút không có request → SIGTERM." : "Cho ngủ ngay → SIGTERM.", "sleep");
    await hop(["box", "r2"], "snapshot");
    await wait(SNAPSHOT);
    setState("sleeping");
    say(`Snapshot cuối đã lên R2 (~1,35 s). Container ngủ, không tốn compute.${s.pending ? " Run chờ duyệt nằm an toàn trong snapshot." : ""}`, "sleep");
  }
  function idleStart() {
    s.idle = SLEEP_AFTER;
    paint();
  }

  // ---- scenarios ----
  const scenarios = {
    async message() {
      const t0 = s.t;
      say("Bạn nhắn: “Tóm tắt giúp các việc hôm nay”.");
      await hop(["user", "worker"], "webhook");
      say("Worker kiểm secret token, trả 200 cho Telegram ngay.");
      await hop(["worker", "do"]);
      await ensureAwake();
      await hop(["do", "box"], "control key");
      setState("running");
      say("Engine nhận turn: master agent bắt đầu tool loop.");
      await modelRound("Model gọi một tool chỉ đọc: không cần duyệt.");
      await hop(["box", "do", "worker", "user"], "trả lời");
      say(`Câu trả lời tới điện thoại sau ${Math.round(s.t - t0)} s.`, "ok");
      setState("ready");
      idleStart();
    },
    async job() {
      const t0 = s.t;
      await hop(["cron", "worker"], "tick");
      say("Cron mỗi phút: Worker đọc D1, thấy một job đến hạn theo timezone.");
      await hop(["worker", "do"]);
      await ensureAwake();
      await hop(["do", "box"], "POST /run");
      setState("running");
      say("Engine chạy job như một turn bình thường.");
      await modelRound("Job gom dữ liệu qua tool chỉ đọc.");
      await hop(["box", "do", "worker", "user"], "kết quả");
      say(`Kết quả job gửi về kênh chat sau ${Math.round(s.t - t0)} s.`, "ok");
      setState("ready");
      idleStart();
    },
    async approval() {
      say("Bạn nhắn: “Gửi email xác nhận lịch hẹn”.");
      await hop(["user", "worker"], "webhook");
      await hop(["worker", "do"]);
      await ensureAwake();
      await hop(["do", "box"], "control key");
      setState("running");
      await modelRound("Model soạn email và muốn gọi tool gửi đi.");
      say("Hành động gửi đi → engine hỏi trước. Run chuyển sang awaiting_approval, lưu trong SQLite.", "ask");
      s.pending++;
      await hop(["box", "do", "worker", "user"], "Duyệt?");
      say("Tin nhắn có nút Duyệt / Từ chối tới điện thoại. Chờ duyệt không giữ container thức.", "ask");
      setState("ready");
      idleStart();
    },
    async approve() {
      const t0 = s.t;
      s.pending--;
      const asleep = s.state === "sleeping";
      say("Bạn bấm Duyệt. Worker trả lời callback ngay.");
      await hop(["user", "worker"], "callback");
      await hop(["worker", "do"]);
      await ensureAwake(asleep);
      await hop(["do", "box"], "approve");
      setState("running");
      say("Engine chạy tiếp turn từ chỗ dừng và thực hiện hành động.");
      await hop(["box", "model"], "prompt");
      await wait(2);
      await hop(["model", "box"], "xong");
      await hop(["box", "do", "worker", "user"], "đã gửi");
      say(`Xong sau ${Math.round(s.t - t0)} s kể từ lúc bấm${asleep ? " (gồm cả resume khi đang ngủ, đo: 17,7 s)" : ""}.`, "ok");
      setState("ready");
      idleStart();
    }
  };

  async function run(fn, arg) {
    if (s.busy) return;
    const g = gen;
    s.busy = true;
    s.idle = null;
    paint();
    try { await fn(arg); }
    catch (e) { if (e !== CANCEL) throw e; }
    finally { if (g === gen) { s.busy = false; s.rate = 0; paint(); } }
  }

  function reset() {
    gen++;
    s = fresh();
    packet.getAnimations().forEach((a) => a.cancel());
    plabel.getAnimations().forEach((a) => a.cancel());
    log.innerHTML = '<li class="empty">Chọn một kịch bản ở trên để bắt đầu.</li>';
    setState("sleeping");
  }

  document.querySelectorAll("[data-scenario]").forEach((b) =>
    b.addEventListener("click", () => run(scenarios[b.dataset.scenario])));
  $("sim-approve").addEventListener("click", () => run(scenarios.approve));
  $("sim-sleep").addEventListener("click", () => { if (s.state !== "sleeping") run(sleepNow, false); });
  $("sim-reset").addEventListener("click", reset);

  s = fresh();
  reset();
  requestAnimationFrame(frame);
})();
