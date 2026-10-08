// 05 — End the monopoly: one company in the middle -> a protocol with no middle.
// Facts on screen: DOJ complaint (May 2024) and the jury verdict (S.D.N.Y., April 15, 2026).
(() => {
  const { abs, vis, prog, ease, clamp, lerp, headline, h, W, H } = GR;
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs, into) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (into) into.appendChild(e);
    return e;
  };
  const rng = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  window.VIDEO = {
    num: "05",
    title: "End the monopoly",
    punch: "You can't buy out\n{g:an open protocol.}",
    build(stage) {
      const L = abs(stage, "layer", "", 0, 0);
      const svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
      const svgWrap = abs(L, "", "", 0, 0, { width: W, height: H });
      svgWrap.appendChild(svg);

      // ---------- S1: the hub ----------
      const s1Label = abs(L, "label r", "The monopoly", 120, 232);
      const s1Head = headline(L, "One company sits\nin the middle of\n{r:everything.}", 120, 278, { size: 92, width: 860 });
      const stat = abs(L, "", `<div style="font-family:var(--display);font-size:120px;font-weight:800;color:var(--negative);letter-spacing:-0.03em;line-height:1">~80%</div>`, 120, 630);
      const statCap = abs(L, "", "Ticketmaster's share of primary ticketing at major U.S. concert venues, as alleged in the U.S. Justice Department's 2024 complaint.", 492, 636, { width: 440, fontSize: 24, lineHeight: 1.35, color: "#b3b3b3", fontWeight: 500 });
      const CX = 1400;
      const CY = 545;
      const R = 290;
      const gHub = svgEl("g", {}, svg);
      const SAT = [
        ["Ticketing", -90],
        ["Promotion", 0],
        ["Venues", 90],
        ["Artist management", 180],
      ];
      const spokes = SAT.map(([, a]) => {
        const x = CX + Math.cos((a * Math.PI) / 180) * R;
        const y = CY + Math.sin((a * Math.PI) / 180) * R;
        const len = R - 150;
        const sx = CX + Math.cos((a * Math.PI) / 180) * 150;
        const sy = CY + Math.sin((a * Math.PI) / 180) * 150;
        return svgEl("line", { x1: sx, y1: sy, x2: x, y2: y, stroke: "rgba(243,114,127,0.55)", "stroke-width": 3, "stroke-dasharray": len, "stroke-dashoffset": len }, gHub);
      });
      const hub = abs(L, "", `<div style="font-size:34px;font-weight:800;line-height:1.15">Live Nation<br>Ticketmaster</div>`, CX - 150, CY - 150, {
        width: 300, height: 300, borderRadius: "50%", background: "#1f1f1f", boxShadow: "inset 0 0 0 4px var(--negative), 0 0 120px rgba(243,114,127,0.18)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      });
      const sats = SAT.map(([name, a]) => {
        const x = CX + Math.cos((a * Math.PI) / 180) * R;
        const y = CY + Math.sin((a * Math.PI) / 180) * R;
        const e = abs(L, "pill outline-r", name, 0, 0, { fontSize: 26, background: "#181818" });
        e.style.left = `${x}px`;
        e.style.top = `${y}px`;
        e.style.translate = "-50% -50%";
        return e;
      });

      // ---------- S2: the verdict ----------
      const s2Label = abs(L, "label", "April 15, 2026 · U.S. federal court", 120, 254, { color: "#fff" });
      const s2Head = headline(L, "A jury found Live Nation\nand Ticketmaster {r:illegally\nmonopolized} ticketing.", 120, 300, { size: 88, width: 1600 });
      const s2Pill = abs(L, "pill outline", "Breakup arguments: 2027 at the earliest", 120, 640, { fontSize: 28, padding: "14px 28px" });
      const s2Sub = abs(L, "sub", "Fans and artists can't wait for the courts. <b>They need a system with no middle to capture.</b>", 120, 740, { width: 1500 });
      const s2Foot = abs(L, "foot", "Jury verdict in the states' case, U.S. District Court for the Southern District of New York, April 15, 2026. Remedies, including a possible breakup, are still pending.", 120, 900, { width: 1680 });

      // ---------- S3: the mesh ----------
      const s3Head = headline(L, "Greenroom has\n{g:no middle} to own.", 120, 250, { size: 100, width: 860 });
      const s3Sub = abs(L, "sub", "Bands, venues, fans and crew deal directly through their agents. The deal itself is an open program on Solana.", 120, 500, { width: 760 });
      const legend = abs(L, "row", "", 120, 740, { gap: "14px", flexWrap: "wrap", width: 800 });
      const TYPES = {
        band: { r: 17, fill: "#1ed760", label: "Bands" },
        venue: { r: 14, fill: "#e6e6e6", label: "Venues" },
        fan: { r: 7, fill: "#8a8a8a", label: "Fans" },
        crew: { r: 10, fill: "#539df5", label: "Crew" },
      };
      const legendEls = Object.values(TYPES).map((ty) => {
        const e = h("span", "pill", `<span style="width:16px;height:16px;border-radius:50%;background:${ty.fill};display:inline-block"></span>${ty.label}`, { fontSize: 22 });
        legend.appendChild(e);
        return e;
      });
      const ghost = abs(L, "", `<div style="font-size:24px;font-weight:700;color:var(--negative);letter-spacing:2px;text-transform:uppercase">the middle</div>`, CX - 110, CY - 110, {
        width: 220, height: 220, borderRadius: "50%", boxShadow: "inset 0 0 0 3px var(--negative)", display: "flex", alignItems: "center", justifyContent: "center",
      });
      const rand = rng(7);
      const box = { x0: 1150, x1: 1790, y0: 190, y1: 910 };
      const nodes = [];
      const plan = [...Array(5).fill("band"), ...Array(7).fill("venue"), ...Array(4).fill("crew"), ...Array(16).fill("fan")];
      for (const type of plan) {
        for (let k = 0; k < 400; k++) {
          const x = lerp(box.x0, box.x1, rand());
          const y = lerp(box.y0, box.y1, rand());
          const minD = type === "fan" ? 70 : 120;
          if (nodes.every((n) => Math.hypot(n.x - x, n.y - y) > (n.type === "fan" && type === "fan" ? 64 : minD))) {
            nodes.push({ type, x, y });
            break;
          }
        }
      }
      const near = (n, type, k) =>
        nodes
          .filter((m) => m.type === type && m !== n)
          .sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))
          .slice(0, k);
      const edges = [];
      nodes.forEach((n) => {
        if (n.type === "band") near(n, "venue", 3).forEach((m) => edges.push([n, m]));
        if (n.type === "fan") near(n, "band", 1).forEach((m) => edges.push([n, m]));
        if (n.type === "crew") near(n, "band", 1).forEach((m) => edges.push([n, m]));
      });
      nodes.forEach((n) => {
        if (n.type === "venue" && !edges.some(([a, b]) => a === n || b === n)) near(n, "band", 1).forEach((m) => edges.push([m, n]));
      });
      const gMesh = svgEl("g", {}, svg);
      const edgeEls = edges.map(([a, b], i) => {
        const len = Math.hypot(a.x - b.x, a.y - b.y);
        const el = svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#3d3d3d", "stroke-width": 2.5, "stroke-dasharray": len, "stroke-dashoffset": len }, gMesh);
        const pk = svgEl("circle", { r: 4.5, fill: "#1ed760", opacity: 0 }, gMesh);
        return { el, len, a, b, pk, at: 14.9 + (i % 17) * 0.09 + Math.floor(i / 17) * 0.25, off: (i * 0.37) % 1, sp: 0.45 + ((i * 13) % 7) * 0.06 };
      });
      const nodeEls = nodes.map((n, i) => {
        const ty = TYPES[n.type];
        const el = svgEl("circle", { cx: n.x, cy: n.y, r: ty.r, fill: ty.fill, stroke: "#121212", "stroke-width": 3, opacity: 0 }, gMesh);
        return { el, n, at: 14.4 + (n.type === "fan" ? 0.6 : 0) + (i % 9) * 0.07 };
      });

      // ---------- S4: why it can't be bought ----------
      const s4Label = abs(L, "label g", "Why it can't be bought", 120, 206);
      const LIST = [
        ["The deal is open code on Solana.", "Anyone can read the terms of every show."],
        ["Refunds and payouts are permissionless.", "No gatekeeper can hold the money back."],
        ["Any venue can join. Any agent can plug in.", "No exclusive contracts, no lock-in."],
        ["Your track record belongs to you.", "On-chain, portable, verifiable by anyone."],
      ];
      const list = LIST.map(([t, s], i) =>
        abs(L, "row", `<div style="flex:none;width:64px;height:64px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><div><div style="font-size:46px;font-weight:800;font-family:var(--display);letter-spacing:-0.02em">${t}</div><div style="font-size:27px;color:#b3b3b3;margin-top:4px">${s}</div></div>`, 120, 262 + i * 152, { gap: "32px", alignItems: "center" }),
      );

      return (t) => {
        // S1
        vis(s1Label, t, 0.25, 6.9, { y: 20 });
        s1Head.update(t, 0.4, 6.9);
        vis(stat, t, 3.2, 6.9, { y: 30 });
        vis(statCap, t, 3.5, 6.9, { y: 20 });
        vis(hub, t, 0.6, 6.95, { y: 0, s: 0.6, d: 0.9, ease: ease.outBack, os: 0.9 });
        const hubOut = prog(t, 6.95, 0.45, ease.inCubic);
        spokes.forEach((s, i) => {
          const len = Number(s.getAttribute("stroke-dasharray"));
          s.setAttribute("stroke-dashoffset", (len * (1 - prog(t, 1.2 + i * 0.12, 0.6, ease.outCubic))).toFixed(1));
          s.setAttribute("opacity", (1 - hubOut).toFixed(3));
        });
        sats.forEach((s, i) => vis(s, t, 1.6 + i * 0.18, 6.95, { y: 0, s: 0.6, d: 0.6, ease: ease.outBack }));

        // S2
        vis(s2Label, t, 7.25, 12.75, { y: 20 });
        s2Head.update(t, 7.4, 12.75, 0.05);
        vis(s2Pill, t, 9.9, 12.75, { y: 20, s: 0.9, ease: ease.outBack, d: 0.55 });
        vis(s2Sub, t, 10.5, 12.75);
        vis(s2Foot, t, 9.0, 12.75, { y: 10 });

        // S3
        s3Head.update(t, 13.05, 20.3);
        vis(s3Sub, t, 14.0, 20.3);
        legendEls.forEach((e, i) => vis(e, t, 15.4 + i * 0.15, 20.3, { y: 16, s: 0.85, ease: ease.outBack, d: 0.5 }));
        const gIn = prog(t, 13.1, 0.5, ease.outBack);
        const gOut = prog(t, 14.0, 0.6, ease.inCubic);
        ghost.style.opacity = (clamp((t - 13.1) / 0.3) * (1 - gOut)).toFixed(3);
        ghost.style.transform = `scale(${(lerp(0.6, 1, gIn) * lerp(1, 0.2, gOut)).toFixed(4)})`;
        ghost.style.visibility = t > 13.05 && t < 14.7 ? "visible" : "hidden";
        const meshDim = prog(t, 20.3, 0.6, ease.inOutCubic);
        const meshOut = prog(t, GR.END_AT - 0.4, 0.4, ease.inCubic);
        gMesh.setAttribute("opacity", (lerp(1, 0.22, meshDim) * (1 - meshOut)).toFixed(3));
        edgeEls.forEach((e) => {
          const p = prog(t, e.at, 0.6, ease.outCubic);
          e.el.setAttribute("stroke-dashoffset", (e.len * (1 - p)).toFixed(1));
          const live = t > 16.2 && t < GR.END_AT;
          if (live) {
            const f = ((t - 16.2) * e.sp + e.off) % 1;
            e.pk.setAttribute("cx", lerp(e.a.x, e.b.x, f).toFixed(1));
            e.pk.setAttribute("cy", lerp(e.a.y, e.b.y, f).toFixed(1));
            e.pk.setAttribute("opacity", (clamp((t - 16.2) / 0.4) * Math.sin(Math.PI * f)).toFixed(3));
          } else e.pk.setAttribute("opacity", 0);
        });
        nodeEls.forEach(({ el, n, at }) => {
          const p = prog(t, at, 0.5, ease.outBack);
          el.setAttribute("opacity", clamp((t - at) / 0.15).toFixed(3));
          el.setAttribute("r", (TYPES[n.type].r * Math.max(0, p)).toFixed(2));
        });

        // S4
        vis(s4Label, t, 20.6, 25.15, { y: 20 });
        list.forEach((e, i) => vis(e, t, 20.8 + i * 0.4, 25.2, { x: -40, y: 0, d: 0.7 }));
      };
    },
  };
})();
