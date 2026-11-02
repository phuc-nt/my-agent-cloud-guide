// Page wiring: theme, embedded archify diagrams and their full viewer, content lists, cost calculator, nav.
(() => {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const theme = () => root.getAttribute("data-theme") || "light";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---- diagrams: archify viewers in embed mode, themed with the page ----
  const diagrams = [...document.querySelectorAll("[data-diagram]")];
  function loadDiagrams() {
    store.set("archify-theme", theme());
    diagrams.forEach((fig) => {
      const frame = fig.querySelector("iframe");
      const src = `diagrams/${fig.dataset.diagram}.html?embed=1&theme=${theme()}`;
      if (frame.getAttribute("src") !== src) frame.setAttribute("src", src);
    });
  }
  const viewer = $("viewer"), vframe = $("viewer-frame");
  diagrams.forEach((fig) => {
    fig.querySelector("[data-open]").addEventListener("click", () => {
      const url = `diagrams/${fig.dataset.diagram}.html?theme=${theme()}`;
      $("viewer-title").textContent = fig.querySelector("iframe").title;
      $("viewer-tab").href = url;
      vframe.src = url;
      viewer.showModal();
    });
  });
  $("viewer-close").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
  viewer.addEventListener("close", () => { vframe.src = "about:blank"; });

  // ---- theme ----
  $("theme").addEventListener("click", () => {
    const next = theme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store.set("guide-theme", next);
    loadDiagrams();
  });
  loadDiagrams();

  // ---- decisions ----
  const G = window.GUIDE;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const dec = $("decisions");
  G.decisions.forEach((d, i) => {
    const det = el("details", "dec");
    if (i === 0) det.open = true;
    const sum = el("summary");
    const head = el("span", null, d.t);
    head.append(el("small", null, d.s));
    sum.append(head);
    const body = el("div", "dec-body");
    const why = el("div"); why.append(el("h4", null, "Vì sao"), el("p", null, d.why));
    const cost = el("div"); cost.append(el("h4", null, "Đánh đổi"), el("p", null, d.cost));
    body.append(why, cost);
    det.append(sum, body);
    dec.append(det);
  });

  // ---- lessons ----
  const les = $("lessons");
  G.lessons.forEach((l) => {
    const card = el("article", "lesson reveal");
    const dl = el("dl");
    dl.append(el("dt", null, "Triệu chứng"), el("dd", null, l.sym), el("dt", null, "Cách xử lý"), el("dd", null, l.fix));
    card.append(el("h3", null, l.t), dl);
    les.append(card);
  });

  // ---- checklist (progress kept in this browser only) ----
  const KEY = "guide-checklist";
  let done = {};
  try { done = JSON.parse(store.get(KEY) || "{}"); } catch (e) { done = {}; }
  const list = $("checklist");
  let total = 0;
  G.checklist.forEach((g, gi) => {
    const box = el("div", "check-group");
    box.append(el("h3", null, g.t));
    const ul = el("ul");
    g.items.forEach((text, ii) => {
      const id = `c${gi}-${ii}`;
      total++;
      const li = el("li");
      const label = el("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!done[id];
      input.addEventListener("change", () => {
        if (input.checked) done[id] = 1; else delete done[id];
        store.set(KEY, JSON.stringify(done));
        countChecks();
      });
      label.append(input, el("span", null, text));
      li.append(label);
      ul.append(li);
    });
    box.append(ul);
    list.append(box);
  });
  function countChecks() {
    const n = list.querySelectorAll("input:checked").length;
    $("check-count").textContent = `${n} / ${total} bước`;
    $("check-bar").style.width = `${(n / total) * 100}%`;
  }
  $("check-reset").addEventListener("click", () => {
    done = {};
    store.set(KEY, "{}");
    list.querySelectorAll("input").forEach((i) => (i.checked = false));
    countChecks();
  });
  countChecks();

  // ---- cost calculator ----
  const PRESETS = { light: [0.5, 15, 2], daily: [2, 40, 4], heavy: [6, 150, 8], always: [24, 150, 8] };
  const HOUR = 0.074, PLATFORM = 5.05, READ = 0.006, WRITE = 0.10, DAYS = 30;
  const hours = $("c-hours"), calls = $("c-calls"), cold = $("c-cold");
  const usd = (v) => (v < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v)}`);
  function calc() {
    const h = +hours.value, c = +calls.value, k = +cold.value;
    $("o-hours").textContent = `${String(h).replace(".", ",")} giờ`;
    $("o-calls").textContent = c;
    $("o-cold").textContent = k;
    const container = h * HOUR * DAYS;
    const model = (c * READ + Math.min(k, c) * WRITE) * DAYS;
    const always = 24 * HOUR * DAYS;
    const total = container + model + PLATFORM;
    $("o-total").textContent = usd(total);
    const max = Math.max(always, container, model, PLATFORM);
    const set = (k2, v) => { $(`b-${k2}`).style.width = `${(v / max) * 100}%`; $(`v-${k2}`).textContent = usd(v); };
    set("container", container); set("model", model); set("platform", PLATFORM); set("always", always);
  }
  [hours, calls, cold].forEach((i) => i.addEventListener("input", () => {
    document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", "false"));
    calc();
  }));
  document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const [h, c, k] = PRESETS[b.dataset.preset];
    hours.value = h; calls.value = c; cold.value = k;
    document.querySelectorAll("[data-preset]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    calc();
  }));
  calc();

  // ---- nav: highlight the section in view; progress bar fallback ----
  const links = [...document.querySelectorAll(".topnav a")];
  const targets = links.map((a) => document.querySelector(a.getAttribute("href")));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === `#${e.target.id}`)));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  targets.forEach((t) => t && spy.observe(t));

  if (!CSS.supports("animation-timeline: scroll()")) {
    const bar = document.querySelector(".progress");
    const upd = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    };
    addEventListener("scroll", upd, { passive: true });
    upd();
  }
})();
