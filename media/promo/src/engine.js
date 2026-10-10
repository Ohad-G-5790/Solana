// Tiny deterministic motion engine: every video is a pure function of time t
// (seconds). render.mjs steps t frame by frame and screenshots the stage.
(() => {
  const W = 1920;
  const H = 1080;
  const DUR = 30;
  const END_AT = 25.6; // shared end card starts here

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = {
    linear: (x) => x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inCubic: (x) => x * x * x,
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: (x) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
  };
  /** Eased 0..1 progress of t through [a, a + d]. */
  const prog = (t, a, d, e = ease.outCubic) => e(clamp((t - a) / d));

  /** Create an element. style keys are CSS properties; numbers become px. */
  function h(tag, cls, html, style) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    if (style) css(el, style);
    return el;
  }
  const UNITLESS = new Set(["opacity", "zIndex", "fontWeight", "lineHeight", "flex"]);
  function css(el, style) {
    for (const [k, v] of Object.entries(style)) el.style[k] = typeof v === "number" && !UNITLESS.has(k) ? `${v}px` : v;
    return el;
  }
  function abs(parent, cls, html, x, y, style = {}) {
    const el = h("div", `abs ${cls || ""}`, html, { left: x, top: y, ...style });
    parent.appendChild(el);
    return el;
  }

  /**
   * Enter at a, leave at b (null = stay). Options: y/x/s/blur = entry offsets,
   * oy/ox/os = exit offsets, d/od = durations.
   */
  function vis(el, t, a, b, o = {}) {
    const i = prog(t, a, o.d ?? 0.7, o.ease ?? ease.outQuint);
    const x = b == null ? 0 : prog(t, b, o.od ?? 0.45, o.oease ?? ease.inCubic);
    const ty = (o.y ?? 40) * (1 - i) + (o.oy ?? -24) * x;
    const tx = (o.x ?? 0) * (1 - i) + (o.ox ?? 0) * x;
    const s = lerp(o.s ?? 1, 1, i) * lerp(1, o.os ?? 1, x);
    const op = i * (1 - x) * (o.max ?? 1);
    el.style.opacity = op.toFixed(4);
    el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})${o.rot ? ` rotate(${o.rot}deg)` : ""}`;
    el.style.visibility = op <= 0.002 ? "hidden" : "visible";
    if (o.blur != null) el.style.filter = `blur(${((o.blur ?? 0) * (1 - i) + (o.oblur ?? 0) * x).toFixed(2)}px)`;
    return op;
  }

  const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const eur = (n, d = 0) => `€${fmt(n, d)}`;
  const typed = (str, t, a, cps = 28) => str.slice(0, Math.max(0, Math.floor((t - a) * cps)));

  /**
   * Headline with per-word stagger. Markup: {g:green words} {r:red words}
   * {m:muted words}, "\n" for a line break.
   */
  function headline(parent, markup, x, y, o = {}) {
    const el = abs(parent, "headline", "", x, y, { fontSize: o.size ?? 84, width: o.width ?? 1500, textAlign: o.align ?? "left" });
    const words = [];
    const re = /\{([grm]):([^}]*)\}|([^{]+)/g;
    let m;
    while ((m = re.exec(markup))) {
      const cls = m[1] ? `em-${m[1]}` : "";
      const text = m[1] ? m[2] : m[3];
      text.split(/(\n)/).forEach((chunk) => {
        if (chunk === "\n") {
          el.appendChild(document.createElement("br"));
          return;
        }
        chunk.split(/( )/).forEach((w) => {
          if (!w) return;
          if (w === " ") {
            el.appendChild(document.createTextNode(" "));
            return;
          }
          const span = h("span", `w ${cls}`, w);
          el.appendChild(span);
          words.push(span);
        });
      });
    }
    return {
      el,
      words,
      update(t, a, b, st = 0.055, opt = {}) {
        words.forEach((w, i) => vis(w, t, a + i * st, b, { y: 70, d: 0.8, oy: -30, od: 0.4, ...opt }));
      },
    };
  }

  // ---------------- dashboard components ----------------
  function badge(state) {
    const label = state === "onSale" ? "on sale" : state;
    return `<span class="badge ${state}">${label}</span>`;
  }

  /** Dashboard ShowCard at 2x. */
  function showCard(parent, x, y, w, d) {
    const el = abs(parent, "card show", "", x, y, { width: w });
    el.innerHTML = `
      <div class="row between"><h3>${d.city}</h3><span class="b"></span></div>
      <div class="meta">${d.venue} · day ${d.day} · ${d.date}</div>
      <div class="progress"><div class="clip"><div class="fill"></div></div><div class="threshold" style="left:${d.threshold ?? 50}%"></div></div>
      <div class="row between counts"><span class="c"></span><span class="e" style="color:var(--text-muted)"></span></div>
      <div class="row between micro"><span class="m1"></span><span class="m2"></span></div>`;
    const q = (s) => el.querySelector(s);
    let lastState = null;
    return {
      el,
      set({ sold, state, escrow, m1 = "", m2 = "" }) {
        const pct = Math.min(100, (sold / d.capacity) * 100);
        const fill = q(".fill");
        fill.style.width = `${pct}%`;
        fill.className = `fill ${state === "cancelled" ? "cancelled" : ""}`;
        q(".c").innerHTML = `<b>${fmt(Math.round(sold))}</b> / ${fmt(d.capacity)} sold · need ${fmt(Math.ceil(d.capacity * (d.threshold ?? 50) / 100))}`;
        q(".e").textContent = escrow ?? "";
        q(".m1").textContent = m1;
        q(".m2").textContent = m2;
        if (state !== lastState) {
          q(".b").innerHTML = badge(state);
          lastState = state;
        }
      },
    };
  }

  function feedItem(parent, x, y, w, d) {
    const el = abs(parent, `feed-item ${d.tx ? "tx" : ""}`, `<div><div class="who">${d.who}</div><div class="kind">${d.kind}</div></div><div class="txt">${d.text}</div>`, x, y, { width: w });
    return el;
  }

  // ---------------- map ----------------
  function makeMap(parent, x, y, w, hgt, bbox) {
    const lat0 = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
    const kx = Math.cos(lat0);
    const dX = (bbox.maxLng - bbox.minLng) * kx;
    const dY = bbox.maxLat - bbox.minLat;
    const s = Math.min(w / dX, hgt / dY);
    const ox = (w - dX * s) / 2;
    const oy = (hgt - dY * s) / 2;
    const proj = (lat, lng) => [ox + (lng - bbox.minLng) * kx * s, oy + (bbox.maxLat - lat) * s];
    const NS = "http://www.w3.org/2000/svg";
    const wrap = abs(parent, "", "", x, y, { width: w, height: hgt });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", w);
    svg.setAttribute("height", hgt);
    svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
    svg.style.overflow = "visible";
    wrap.appendChild(svg);
    const mk = (tag, attrs, into = svg) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      into.appendChild(e);
      return e;
    };
    // country outlines
    let dPath = "";
    for (const c of window.GEO.countries) {
      for (const r of c.rings) {
        dPath += r.map(([lng, lat], i) => `${i ? "L" : "M"}${proj(lat, lng)[0].toFixed(1)},${proj(lat, lng)[1].toFixed(1)}`).join("") + "Z";
      }
    }
    const land = mk("path", { d: dPath, fill: "#1a1a1a", stroke: "#3a3a3a", "stroke-width": 1.5, "stroke-linejoin": "round" });
    const gDots = mk("g", {});
    const dots = window.GEO.venues.map((v) => {
      const [px, py] = proj(v.lat, v.lng);
      return { v, el: mk("circle", { cx: px, cy: py, r: 4.5, fill: "#5a5a5a" }, gDots), x: px, y: py };
    });
    const gTop = mk("g", {});
    return { wrap, svg, proj, land, dots, gDots, gTop, mk, NS };
  }

  /** Dashed route drawn progressively (dashes revealed through a mask). */
  function route(map, pts, id) {
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const defs = map.mk("defs", {}, map.gTop);
    const mask = map.mk("mask", { id: `m-${id}`, maskUnits: "userSpaceOnUse" }, defs);
    const mp = map.mk("path", { d, stroke: "#fff", "stroke-width": 14, fill: "none", "stroke-dasharray": len, "stroke-dashoffset": len, "stroke-linecap": "round", "stroke-linejoin": "round" }, mask);
    const glow = map.mk("path", { d, stroke: "rgba(30,215,96,0.18)", "stroke-width": 12, fill: "none", mask: `url(#m-${id})`, "stroke-linecap": "round", "stroke-linejoin": "round" }, map.gTop);
    const path = map.mk("path", { d, stroke: "#1ed760", "stroke-width": 4, fill: "none", "stroke-dasharray": "12 10", mask: `url(#m-${id})` }, map.gTop);
    return {
      len,
      path,
      glow,
      set(p) {
        mp.setAttribute("stroke-dashoffset", (len * (1 - p)).toFixed(1));
      },
      // fraction of the path length at which vertex i is reached
      at(i) {
        let l = 0;
        for (let k = 1; k <= i; k++) l += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        return l / len;
      },
    };
  }

  const km = (a, b) => {
    const R = 6371;
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r;
    const dLng = (b.lng - a.lng) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  const city = (name) => window.GEO.cities.find((c) => c.name === name);

  // ---------------- shared chrome + end card ----------------
  function chrome(stage) {
    const logo = abs(stage, "brand", `<span class="dot"></span>Greenroom`, 120, 66);
    const player = abs(stage, "player", `<span class="num t0">0:00</span><div class="track"><div class="fill"></div><div class="knob"></div></div><span class="num">0:30</span>`, 120, 1004, { width: W - 240 });
    const t0 = player.querySelector(".t0");
    const fill = player.querySelector(".fill");
    const knob = player.querySelector(".knob");
    return (t) => {
      vis(logo, t, 0.1, END_AT - 0.2, { y: -20, d: 0.8 });
      vis(player, t, 0.3, null, { y: 20, d: 0.8, max: 0.9 });
      const p = clamp(t / DUR);
      fill.style.width = `${p * 100}%`;
      knob.style.left = `${p * 100}%`;
      t0.textContent = `0:${String(Math.floor(t)).padStart(2, "0")}`;
    };
  }

  function endCard(stage, punch) {
    const layer = abs(stage, "layer", "", 0, 0, { width: W, height: H });
    const hl = headline(layer, punch, 160, 300, { size: 108, width: W - 320, align: "center" });
    const lock = abs(layer, "", "", 0, 610, { width: W, display: "flex", justifyContent: "center", alignItems: "center", gap: "28px" });
    const dot = h("div", "", "", { width: 92, height: 92, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 80px rgba(30,215,96,0.25)" });
    const wordWrap = h("div", "", "", { overflow: "hidden", paddingRight: 8 });
    const word = h("div", "", "Greenroom", { fontFamily: "var(--display)", fontWeight: 800, fontSize: 96, letterSpacing: "-0.03em", lineHeight: 1.1 });
    wordWrap.appendChild(word);
    lock.append(dot, wordWrap);
    const tag = abs(layer, "sub", "Tours that book themselves. <b>The deal lives on Solana.</b>", 0, 760, { width: W, textAlign: "center", fontSize: 36 });
    return (t) => {
      hl.update(t, END_AT + 0.15, null, 0.06);
      const pd = prog(t, END_AT + 1.0, 0.8, ease.outBack);
      dot.style.transform = `scale(${pd.toFixed(4)})`;
      dot.style.opacity = clamp((t - END_AT - 1.0) / 0.2).toFixed(3);
      const pw = prog(t, END_AT + 1.25, 0.9, ease.outQuint);
      word.style.transform = `translateX(${((1 - pw) * -110).toFixed(1)}%)`;
      vis(tag, t, END_AT + 1.7, null, { y: 24, d: 0.8 });
    };
  }

  window.GR = { W, H, DUR, END_AT, clamp, lerp, ease, prog, h, css, abs, vis, fmt, eur, typed, headline, badge, showCard, feedItem, makeMap, route, km, city, chrome, endCard };
})();
