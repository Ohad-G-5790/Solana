// Vertical (1080x1920) kit for the musician's-phone series. Builds on engine.js (GR).
(() => {
  const { abs, vis, prog, ease, clamp, lerp, h, fmt, headline } = GR;
  const VW = 1080;
  const VH = 1920;
  const END = GR.END_AT;
  const eur = (n) => `€${fmt(Math.round(n))}`;

  const STATUS_ICONS = `<svg width="150" height="30" viewBox="0 0 150 30" fill="#fff">
    <rect x="0" y="20" width="7" height="10" rx="2"/><rect x="11" y="14" width="7" height="16" rx="2"/><rect x="22" y="8" width="7" height="22" rx="2"/><rect x="33" y="2" width="7" height="28" rx="2"/>
    <path d="M62 12a20 20 0 0 1 28 0l-3 3a16 16 0 0 0-22 0zM68 18a11 11 0 0 1 16 0l-3 3a7 7 0 0 0-10 0zM76 28l-4-4a6 6 0 0 1 8 0z"/>
    <rect x="102" y="5" width="40" height="20" rx="6" fill="none" stroke="#fff" stroke-width="2.5"/><rect x="106" y="9" width="28" height="12" rx="3"/><rect x="144" y="11" width="4" height="8" rx="2"/>
  </svg>`;

  /** A phone at (x, y) on the stage; its screen hosts panes at 760px width. */
  function makePhone(parent, { x = 180, y = 500, scale = 0.9, time = "09:41", me = "M" } = {}) {
    const el = abs(parent, "phone", "", 0, 0);
    el.innerHTML = `<div class="ph-screen"><div class="ph-cam"></div><div class="ph-status"><span class="tm">${time}</span>${STATUS_ICONS}</div><div class="ph-appbar"><span class="row" style="gap:14px"><span class="dot"></span>Greenroom</span><span class="me">${me}</span></div><div class="ph-panes"></div></div>`;
    const panes = el.querySelector(".ph-panes");
    const tm = el.querySelector(".tm");
    return {
      el,
      panes,
      setTime(s) {
        if (tm.textContent !== s) tm.textContent = s;
      },
      /** Rise in from below at a, drop away at b. */
      show(t, a, b, o = {}) {
        const i = prog(t, a, o.d ?? 1.1, ease.outQuint);
        const xo = b == null ? 0 : prog(t, b, 0.5, ease.inCubic);
        const dy = (1 - i) * (o.from ?? 480) + xo * 260;
        el.style.transform = `translate(${x}px, ${(y + dy).toFixed(2)}px) scale(${scale})`;
        const op = Math.min(1, i * 1.5) * (1 - xo);
        el.style.opacity = op.toFixed(4);
        el.style.visibility = op <= 0.002 ? "hidden" : "visible";
      },
    };
  }

  const pane = (ph) => {
    const p = h("div", "pane abs");
    ph.panes.appendChild(p);
    return p;
  };
  /** Panes swipe in from the right and leave to the left. */
  const paneVis = (p, t, a, b) => vis(p, t, a, b, { x: 110, y: 0, ox: -110, oy: 0, d: 0.7, od: 0.4 });
  const add = (p, cls, html, style) => {
    const e = h("div", cls, html, style);
    p.appendChild(e);
    return e;
  };
  const title = (p, t, s) => {
    const a = add(p, "pt", t);
    const b = s ? add(p, "ps", s) : null;
    return [a, b];
  };
  const badge = (state) => `<span class="badge ${state}" style="font-size:22px">${state === "onSale" ? "on sale" : state}</span>`;

  /** Show row with progress bar and threshold marker (dashboard ShowCard, phone-sized). */
  function progRow(p, d) {
    const e = add(p, "prow", `
      <div class="row between"><b style="font-size:30px">${d.name}</b><span class="b"></span></div>
      ${d.sub ? `<div style="font-size:23px;color:#b3b3b3;margin-top:4px">${d.sub}</div>` : ""}
      <div class="pbar"><div class="clip"><div class="fill"></div></div><div class="thr" style="left:${d.thr ?? 50}%"></div></div>
      <div class="row between" style="margin-top:12px;font-size:23px"><span class="c"></span><span class="e" style="color:#b3b3b3"></span></div>`);
    const fill = e.querySelector(".fill");
    const c = e.querySelector(".c");
    const r = e.querySelector(".e");
    const b = e.querySelector(".b");
    let last = null;
    return {
      el: e,
      set({ sold, state, right = "" }) {
        fill.style.width = `${Math.min(100, (sold / d.cap) * 100)}%`;
        fill.className = `fill ${state === "cancelled" ? "cancelled" : ""}`;
        c.innerHTML = `<b>${fmt(Math.round(sold))}</b> / ${fmt(d.cap)} sold`;
        r.textContent = right;
        if (state !== last) {
          b.innerHTML = state ? badge(state) : "";
          last = state;
        }
      },
    };
  }

  /** Horizontal split bar with labelled parts; set(p) grows it. */
  function splitBar(p, parts, o = {}) {
    const e = add(p, "", "", { marginTop: o.mt ?? 6 });
    e.innerHTML = `<div style="position:relative;height:${o.hgt ?? 56}px;border-radius:14px;overflow:hidden;background:#262626">${parts
      .map((q) => `<div class="sp" style="position:absolute;top:0;bottom:0;background:${q.color}"></div>`)
      .join("")}</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">${parts
        .map((q) => `<div class="row between sl" style="font-size:${o.fs ?? 27}px"><span class="row" style="gap:14px"><span style="width:${o.fs ? 28 : 20}px;height:${o.fs ? 28 : 20}px;border-radius:6px;background:${q.color};display:inline-block"></span>${q.label}</span><b class="num" style="color:#fff">${q.amount ?? ""}</b></div>`)
        .join("")}</div>`;
    const segs = [...e.querySelectorAll(".sp")];
    const labels = [...e.querySelectorAll(".sl")];
    return {
      el: e,
      set(pp, t, at) {
        let acc = 0;
        parts.forEach((q, i) => {
          segs[i].style.left = `${acc * pp}%`;
          segs[i].style.width = `${q.pct * pp}%`;
          acc += q.pct;
          if (t != null) vis(labels[i], t, at + 0.15 * i, null, { y: 14, d: 0.5 });
        });
      },
    };
  }

  /** Vertical list of labelled bars (earnings per city). */
  function barList(p, rows, max, o = {}) {
    const e = add(p, "", "", { display: "flex", flexDirection: "column", gap: `${o.gap ?? 14}px` });
    const items = rows.map((r) => {
      const it = h("div", "", `<div class="row between" style="font-size:24px"><span>${r.label}</span><b class="v num" style="color:${r.color ?? "#fff"}"></b></div><div style="height:16px;border-radius:9999px;background:#262626;margin-top:8px;overflow:hidden"><div class="f" style="height:100%;border-radius:9999px;background:${r.bar ?? "var(--accent)"}"></div></div>`);
      e.appendChild(it);
      return { it, r, f: it.querySelector(".f"), v: it.querySelector(".v") };
    });
    return {
      el: e,
      set(t, a, stagger = 0.12) {
        items.forEach(({ r, f, v }, i) => {
          const pp = prog(t, a + i * stagger, 0.8, ease.outCubic);
          f.style.width = `${(r.value / max) * 100 * pp}%`;
          v.textContent = r.text ? r.text(pp) : eur(r.value * pp);
        });
      },
    };
  }

  function notif(parent, x, y, w, d) {
    return abs(parent, "notif", `<div class="ic"><span></span></div><div style="flex:1;min-width:0"><div class="app"><span>GREENROOM</span><span>${d.time ?? "now"}</span></div><div class="tt">${d.title}</div>${d.body ? `<div class="bd">${d.body}</div>` : ""}</div>`, x, y, { width: w });
  }
  /** Banners that drop in one after another, newest on top. */
  function notifStack(parent, x, y, w, list, gap = 18) {
    const items = list.map((d) => ({ d, el: notif(parent, x, y, w, d) }));
    return (t, out) => {
      items.forEach((it, i) => {
        let dy = 0;
        items.forEach((o, j) => {
          if (j > i) dy += (o.el.offsetHeight + gap) * prog(t, o.d.at, 0.45, ease.outCubic);
        });
        it.el.style.top = `${y + dy}px`;
        vis(it.el, t, it.d.at, out, { y: -70, d: 0.55, ease: ease.outCubic, s: 0.96 });
      });
    };
  }

  /** Label + first-person headline (+ optional sub) above the phone. */
  function sceneText(stage, d) {
    const lab = d.label ? abs(stage, `label ${d.lc ?? ""}`, d.label, 64, 168, { fontSize: 22 }) : null;
    const hd = headline(stage, d.head, 64, 212, { size: d.size ?? 76, width: 952 });
    const sub = d.sub ? abs(stage, "sub", d.sub, 64, d.subY ?? 396, { width: 952, fontSize: 30 }) : null;
    return (t) => {
      if (lab) vis(lab, t, d.a, d.b, { y: 20 });
      hd.update(t, d.a + 0.1, d.b, 0.05);
      if (sub) vis(sub, t, d.a + 0.9, d.b);
    };
  }

  function chromeV(stage, tag) {
    const logo = abs(stage, "brand", `<span class="dot"></span>Greenroom`, 64, 66, { fontSize: 28 });
    const pill = abs(stage, "chapter", tag, 0, 58, { right: 64, left: "auto", fontSize: 18, padding: "12px 22px", letterSpacing: "1.6px" });
    return (t) => {
      vis(logo, t, 0.1, END - 0.2, { y: -20, d: 0.8 });
      vis(pill, t, 0.25, END - 0.2, { y: -20, d: 0.8 });
    };
  }

  function endCardV(stage, { kicker, punch }) {
    const layer = abs(stage, "layer", "", 0, 0, { width: VW, height: VH });
    const kick = kicker ? abs(layer, "label g", kicker, 0, 548, { width: VW, textAlign: "center" }) : null;
    const hl = headline(layer, punch, 64, 600, { size: 100, width: 952, align: "center" });
    const lock = abs(layer, "", "", 0, 980, { width: VW, display: "flex", justifyContent: "center", alignItems: "center", gap: "26px" });
    const dot = h("div", "", "", { width: 84, height: 84, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 80px rgba(30,215,96,0.25)" });
    const wordWrap = h("div", "", "", { overflow: "hidden", paddingRight: 8 });
    const word = h("div", "", "Greenroom", { fontFamily: "var(--display)", fontWeight: 800, fontSize: 90, letterSpacing: "-0.03em", lineHeight: 1.1 });
    wordWrap.appendChild(word);
    lock.append(dot, wordWrap);
    const tag = abs(layer, "sub", "Tours that book themselves.<br><b>The deal lives on Solana.</b>", 0, 1120, { width: VW, textAlign: "center", fontSize: 36 });
    const foot = abs(layer, "foot", "Illustrative figures. Tickets settle on Solana.", 0, 1810, { width: VW, textAlign: "center", fontSize: 20 });
    return (t) => {
      if (kick) vis(kick, t, END + 0.05, null, { y: 16 });
      hl.update(t, END + 0.15, null, 0.06);
      const pd = prog(t, END + 1.0, 0.8, ease.outBack);
      dot.style.transform = `scale(${pd.toFixed(4)})`;
      dot.style.opacity = clamp((t - END - 1.0) / 0.2).toFixed(3);
      const pw = prog(t, END + 1.25, 0.9, ease.outQuint);
      word.style.transform = `translateX(${((1 - pw) * -110).toFixed(1)}%)`;
      vis(tag, t, END + 1.7, null, { y: 24, d: 0.8 });
      vis(foot, t, END + 2.0, null, { y: 0, d: 0.8, max: 0.9 });
    };
  }

  /** Chapter pill markup: "<series> 1 / 5 · Title". */
  const tag = (series, n, name) => `<span>${series}</span><b>${n}</b><span>/ 5</span><span style="width:2px;height:18px;background:#4d4d4d;display:inline-block"></span><span style="color:#fff">${name}</span>`;

  // Scene windows shared by every vertical video.
  const S = [
    [0.3, 6.1],
    [6.3, 12.5],
    [12.7, 18.9],
    [19.1, 25.2],
  ];

  // ---------- small vs big (series c): two phones side by side ----------
  const DUO = { scale: 0.6, y: 470, lx: 40, rx: 560 };
  /** Two phones with name pills above them. */
  function duo(stage, left, right) {
    const L = makePhone(stage, { x: DUO.lx, y: DUO.y, scale: DUO.scale, me: left.me });
    const R = makePhone(stage, { x: DUO.rx, y: DUO.y, scale: DUO.scale, me: right.me });
    // The lower part of each screen is mostly empty here: let the phones sink into the background.
    for (const p of [L, R]) p.el.style.webkitMaskImage = "linear-gradient(to bottom, #000 58%, transparent 90%)";
    const pill = (x, d) => abs(stage, "who-pill", `${d.name} <i>· ${d.size}</i>`, x, 150);
    const pl = pill(DUO.lx, left);
    const pr = pill(DUO.rx, right);
    return {
      L,
      R,
      show(t) {
        L.show(t, 0.2, END - 0.4);
        R.show(t, 0.35, END - 0.35);
        vis(pl, t, 0.3, END - 0.3, { y: -16, d: 0.7 });
        vis(pr, t, 0.45, END - 0.3, { y: -16, d: 0.7 });
      },
    };
  }
  /** First-person quote above each phone, and a shared conclusion under them. */
  function duoText(stage, d) {
    const ql = headline(stage, d.L, DUO.lx, 224, { size: d.qs ?? 50, width: 480 });
    const qr = headline(stage, d.R, DUO.rx, 224, { size: d.qs ?? 50, width: 480 });
    const fo = headline(stage, d.foot, 64, 1520, { size: d.fs ?? 74, width: 952, align: "center" });
    return (t) => {
      ql.update(t, d.a + 0.1, d.b, 0.05);
      qr.update(t, d.a + 0.55, d.b, 0.05);
      fo.update(t, d.a + 1.3, d.b, 0.05);
    };
  }
  /** Big-type card for the smaller side-by-side phones. */
  const bigCard = (p, k, v, o = {}) =>
    add(p, "prow", `<div class="k" style="font-size:30px">${k}</div><div class="big n" style="font-size:${o.size ?? 104}px;color:${o.color ?? "#fff"};margin-top:6px">${v}</div>${o.note ? `<div style="font-size:32px;color:#b3b3b3;margin-top:8px">${o.note}</div>` : ""}`, { padding: "30px 34px" });
  const bigRow = (p, l, r, o = {}) =>
    add(p, "prow row between", `<span style="font-size:46px;font-weight:700;color:#fff">${l}</span><span style="font-size:44px;font-weight:800;color:${o.color ?? "var(--accent)"}">${r}</span>`, { padding: "34px 34px", borderRadius: 32 });
  const bigTitle = (p, t) => add(p, "pt", t, { fontSize: 70, marginBottom: 10 });
  /** Progress card with big type. */
  function bigProg(p, d) {
    const e = add(p, "prow", `<div class="row between"><b style="font-size:42px">${d.name}</b><span class="b"></span></div>
      <div class="pbar" style="height:30px;margin-top:24px"><div class="clip"><div class="fill"></div></div><div class="thr" style="left:50%;height:46px;top:-8px;width:6px;margin-left:-3px"></div></div>
      <div style="margin-top:18px;font-size:36px"><b class="c" style="color:#fff">0</b><span style="color:#b3b3b3"> / ${fmt(d.cap)}</span></div>
      <div class="m" style="margin-top:6px;font-size:30px;color:#b3b3b3"></div>`, { padding: "30px 34px" });
    const fill = e.querySelector(".fill");
    const c = e.querySelector(".c");
    const m = e.querySelector(".m");
    const b = e.querySelector(".b");
    let last;
    return {
      el: e,
      set({ sold, state, note = "" }) {
        fill.style.width = `${Math.min(100, (sold / d.cap) * 100)}%`;
        fill.className = `fill ${state === "cancelled" ? "cancelled" : ""}`;
        c.textContent = fmt(Math.round(sold));
        m.textContent = note;
        if (state !== last) {
          b.innerHTML = `<span class="badge ${state}" style="font-size:28px">${state === "onSale" ? "on sale" : state}</span>`;
          last = state;
        }
      },
    };
  }
  // The two acts compared in series c (same people as b1 and b4).
  const LENA = { name: "Lena", size: "solo · 150", me: "L", price: 18, cap: 150 };
  const RUSTY = { name: "Rusty Pilots", size: "3,500", me: "RP", price: 45, cap: 3500 };

  // One band's November tour (series a). Venues are real entries in data/venues.json.
  const TOUR = {
    band: "Cinema of Royal Street",
    price: 25,
    venueBps: 3000,
    stops: [
      { city: "Berlin", venue: "Lido", date: "Nov 3", cap: 400, sold: 372 },
      { city: "Leipzig", venue: "Conne Island", date: "Nov 4", cap: 400, sold: 318 },
      { city: "Dresden", venue: "Beatpol", date: "Nov 5", cap: 400, sold: 264 },
      { city: "Prague", venue: "Palác Akropolis", date: "Nov 7", cap: 400, sold: 351 },
      { city: "Brno", venue: "Metro Music Bar", date: "Nov 8", cap: 400, sold: 226 },
      { city: "Vienna", venue: "WUK", date: "Nov 9", cap: 400, sold: 141, cancelled: true },
      { city: "Salzburg", venue: "Rockhouse", date: "Nov 11", cap: 350, sold: 249 },
      { city: "Munich", venue: "Strom", date: "Nov 12", cap: 400, sold: 337 },
    ],
  };

  window.PK = { TOUR, DUO, duo, duoText, bigCard, bigRow, bigTitle, bigProg, LENA, RUSTY, VW, VH, END, S, eur, makePhone, pane, paneVis, add, title, badge, progRow, splitBar, barList, notif, notifStack, sceneText, chromeV, endCardV, tag };
})();
