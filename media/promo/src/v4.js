// 04 — Musicians earn more: paid last -> paid by code, a record that lowers the
// venue's ask, and cheaper roads.
(() => {
  const { abs, vis, prog, ease, clamp, lerp, headline, feedItem, makeMap, route, city, fmt, h } = GR;

  window.VIDEO = {
    punch: "More of every ticket goes\nto {g:the people on stage.}",
    build(stage) {
      const L = abs(stage, "layer", "", 0, 0);

      // ---------- S1: paid last ----------
      const s1Label = abs(L, "label r", "Where the money goes", 120, 262);
      const s1Head = headline(L, "The band plays.\n{r:Everyone else}\ngets paid first.", 120, 310, { size: 100, width: 860 });
      const q = abs(L, "card", "", 1010, 216, { width: 790, height: 636 });
      q.innerHTML = `<div class="row between"><span style="font-size:32px;font-weight:700">Who gets paid, in order</span><span class="pill" style="font-size:20px">The old way</span></div>`;
      const QUEUE = [
        ["Ticketing platform", "Fees on every ticket", false],
        ["Promoter", "A margin for carrying the risk", false],
        ["Booking agent", "Commission on the band's fee", false],
        ["The band", "Whatever is left", true],
      ];
      const qRows = QUEUE.map(([t, s, last], i) => {
        const r = h("div", "abs", `<div class="row" style="gap:24px;height:110px;padding:0 28px;border-radius:14px;background:${last ? "transparent" : "#1f1f1f"};box-shadow:${last ? "inset 0 0 0 2px #4d4d4d" : "none"}">
            <div style="flex:none;width:52px;height:52px;border-radius:50%;background:${last ? "#2a2a2a" : "rgba(243,114,127,0.14)"};color:${last ? "#b3b3b3" : "var(--negative)"};font-weight:800;font-size:24px;display:flex;align-items:center;justify-content:center">${i + 1}</div>
            <div style="flex:1"><div style="font-size:30px;font-weight:700;color:${last ? "#b3b3b3" : "#fff"}">${t}</div><div style="font-size:23px;color:#8a8a8a;margin-top:4px">${s}</div></div>
            ${last ? `<span class="pill outline-r" style="font-size:20px">last</span>` : ""}
          </div>`, { left: 32, top: 112 + i * 128, width: 726 });
        q.appendChild(r);
        return r;
      });

      // ---------- S2: the split is code ----------
      const s2Label = abs(L, "label g", "With Greenroom", 120, 262);
      const s2Head = headline(L, "The deal\nis {g:code.}", 120, 306, { size: 110, width: 820 });
      const s2Sub = abs(L, "sub", "Fans pay into the show's escrow. After the show, anyone can trigger settlement, and the program pays everyone <b>in one transaction.</b>", 120, 562, { width: 760 });
      const vault = abs(L, "card", "", 1000, 226, { width: 800, height: 612, padding: "36px 40px" });
      vault.innerHTML = `
        <div class="row between"><span style="font-size:30px;font-weight:700">Show vault · Berlin, Nov 3</span><span class="pill" style="font-size:20px">Example</span></div>
        <div class="num val" style="font-family:var(--display);font-size:120px;font-weight:800;letter-spacing:-0.03em;margin-top:30px;line-height:1">€0</div>
        <div class="num tix" style="font-size:28px;color:#b3b3b3;margin-top:14px">0 tickets × €25</div>
        <div class="row" style="margin-top:34px;gap:16px"><span class="pill call mono" style="font-size:22px;color:var(--accent);box-shadow:inset 0 0 0 2px var(--accent);background:transparent">settle_show()</span><span class="note" style="font-size:22px;color:#8a8a8a">after the show date · anyone can call it</span></div>
        <div style="position:relative;height:72px;margin-top:30px;border-radius:12px;overflow:hidden;background:#1f1f1f">
          <div class="b" style="position:absolute;left:0;top:0;bottom:0;background:var(--accent)"></div>
          <div class="v" style="position:absolute;top:0;bottom:0;background:#e6e6e6"></div>
        </div>
        <div class="row between lbls" style="margin-top:20px;align-items:flex-start">
          <div><div style="font-size:22px;color:#b3b3b3">Band · 70%</div><div class="num" style="font-size:40px;font-weight:800;margin-top:2px;color:var(--accent)">€7,000</div></div>
          <div style="text-align:right"><div style="font-size:22px;color:#b3b3b3">Venue · 30%</div><div class="num" style="font-size:40px;font-weight:800;margin-top:2px">€3,000</div></div>
        </div>`;
      const vVal = vault.querySelector(".val");
      const vTix = vault.querySelector(".tix");
      const vCall = vault.querySelector(".call");
      const vNote = vault.querySelector(".note");
      const vB = vault.querySelector(".b");
      const vV = vault.querySelector(".v");
      const vL = vault.querySelector(".lbls");

      // ---------- S3: the record is leverage ----------
      const s3Head = headline(L, "Your history is\nyour {g:leverage.}", 120, 250, { size: 100, width: 860 });
      const s3Sub = abs(L, "sub", "Every settled show is written to your band's on-chain record. Venue agents read it, <b>and ask for less.</b>", 120, 500, { width: 760 });
      const s3Foot = abs(L, "foot", "Venue-agent pricing as built in Greenroom: 30% base share, +5 points for a band with no history, −3 for a strong record.", 120, 900, { width: 1680 });
      const rec = abs(L, "card", "", 1000, 196, { width: 800, height: 690, padding: "36px 40px" });
      rec.innerHTML = `
        <div style="font-size:22px;font-weight:700;letter-spacing:2.8px;text-transform:uppercase;color:#b3b3b3">Band record · on-chain</div>
        <div style="font-size:34px;font-weight:700;margin-top:8px">Cinema of Royal Street</div>
        <div class="row" style="gap:20px;margin-top:26px">
          <div class="stat" style="flex:1;background:#1f1f1f"><div class="k">Shows settled</div><div class="v n1">0</div></div>
          <div class="stat" style="flex:1;background:#1f1f1f"><div class="k">Tickets sold</div><div class="v n2">0</div></div>
        </div>`;
      const n1 = rec.querySelector(".n1");
      const n2 = rec.querySelector(".n2");
      const cmp = (label, ask, band, color, y) => {
        const e = h("div", "abs", `
          <div class="row between"><span style="font-size:26px;font-weight:700">${label}</span><span style="font-size:22px;color:#b3b3b3">venue asks ${ask}%</span></div>
          <div style="position:relative;height:44px;margin-top:12px;border-radius:9999px;background:#2a2a2a;overflow:hidden"><div class="f" style="position:absolute;left:0;top:0;bottom:0;border-radius:9999px;background:${color};display:flex;align-items:center;justify-content:flex-end;padding-right:18px;color:#000;font-weight:800;font-size:22px;white-space:nowrap"><span>${band}% to the band</span></div></div>`, { left: 40, top: y, width: 720 });
        rec.appendChild(e);
        return { e, f: e.querySelector(".f"), band };
      };
      const cA = cmp("No history yet", 35, 65, "#cbcbcb", 352);
      const cB = cmp("Proven record", 27, 73, "var(--accent)", 476);
      const plus = h("div", "abs pill g", "+8 points to the band. Same room, same night.", { left: 40, top: 594, fontSize: 23 });
      rec.appendChild(plus);

      // ---------- S4: cheaper roads ----------
      const s4Head = headline(L, "And you spend {g:less} on the road.", 120, 190, { size: 80, width: 1700 });
      const map = makeMap(L, 100, 300, 820, 640, { minLng: 8.6, maxLng: 19.4, minLat: 46.4, maxLat: 53.6 });
      map.wrap.style.webkitMaskImage = "radial-gradient(closest-side, #000 78%, transparent 100%)";
      const STOPS = ["Berlin", "Leipzig", "Dresden", "Prague", "Brno", "Vienna", "Salzburg", "Munich"].map(city);
      const pts = STOPS.map((c) => map.proj(c.lat, c.lng));
      const rt = route(map, pts, "v4");
      const stopEls = STOPS.map((c, i) => {
        const [x, y] = pts[i];
        const g = map.mk("g", { opacity: 0 }, map.gTop);
        map.mk("circle", { cx: x, cy: y, r: 10, fill: "#1ed760", stroke: "#121212", "stroke-width": 3 }, g);
        const side = { Leipzig: "left", Munich: "left", Salzburg: "below" }[c.name] ?? "right";
        const tx = map.mk("text", { x: side === "right" ? x + 16 : side === "left" ? x - 16 : x, y: side === "below" ? y + 36 : y + 7, fill: "#e6e6e6", "font-size": 21, "font-weight": 700, "text-anchor": side === "right" ? "start" : side === "left" ? "end" : "middle" }, g);
        tx.textContent = c.name;
        return { g, at: rt.at(i) };
      });
      const offer = feedItem(L, 1000, 330, 800, { who: "Crew agent", kind: "crew.offer", text: "Jana Novák, photographer in Prague (4.8★, 6 yrs): available for 3% of the show." });
      const hired = feedItem(L, 1000, 476, 800, { who: "Band agent", kind: "crew.hired", tx: true, text: "Hired Jana Novák as photographer for Prague at 3% of the show. Paid from the split." });
      const s4Sub = abs(L, "sub", "Routes planned for distance, with rest days. Local crew, paid straight from the escrow: <b>no invoices, no chasing.</b>", 1000, 650, { width: 800, fontSize: 31 });

      return (t) => {
        // S1
        vis(s1Label, t, 0.25, 6.1, { y: 20 });
        s1Head.update(t, 0.4, 6.1);
        vis(q, t, 0.5, 6.15, { y: 60, s: 0.97, d: 0.9 });
        qRows.forEach((r, i) => vis(r, t, 0.9 + i * 0.45 + (i === 3 ? 0.4 : 0), null, { x: 50, y: 0, d: 0.6 }));

        // S2
        vis(s2Label, t, 6.4, 13.3, { y: 20 });
        s2Head.update(t, 6.5, 13.3);
        vis(s2Sub, t, 7.4, 13.3);
        vis(vault, t, 6.7, 13.35, { y: 60, s: 0.97, d: 0.9 });
        const fill = prog(t, 7.2, 2.2, ease.inOutCubic);
        vVal.textContent = `€${fmt(Math.round(10000 * fill))}`;
        vTix.textContent = `${fmt(Math.round(400 * fill))} tickets × €25`;
        const pulse = t > 9.8 && t < 10.3 ? 1 + 0.06 * Math.sin(((t - 9.8) / 0.5) * Math.PI) : 1;
        vis(vCall, t, 9.6, null, { y: 0, s: 0.8, d: 0.5, ease: ease.outBack });
        vCall.style.transform += ` scale(${pulse.toFixed(4)})`;
        vis(vNote, t, 9.8, null, { y: 0, x: -10, d: 0.5 });
        const sp = prog(t, 10.3, 1.0, ease.inOutCubic);
        vB.style.width = `${70 * sp}%`;
        vV.style.left = `${70 + 30 * (1 - sp)}%`;
        vV.style.width = `${30 * sp}%`;
        vis(vL, t, 10.9, null, { y: 16, d: 0.5 });
        vVal.style.color = t > 10.3 ? "#5a5a5a" : "#fff";

        // S3
        s3Head.update(t, 13.6, 20.3);
        vis(s3Sub, t, 14.4, 20.3);
        vis(s3Foot, t, 16.0, 20.3, { y: 10 });
        vis(rec, t, 13.8, 20.35, { y: 60, s: 0.97, d: 0.9 });
        const np = prog(t, 14.3, 1.6, ease.outCubic);
        n1.textContent = Math.round(12 * np);
        n2.textContent = fmt(Math.round(4380 * np));
        [cA, cB].forEach((c, i) => {
          vis(c.e, t, 16.2 + i * 0.8, null, { y: 24, d: 0.6 });
          c.f.style.width = `${c.band * prog(t, 16.4 + i * 0.8, 0.9, ease.outCubic)}%`;
        });
        vis(plus, t, 18.2, null, { y: 16, s: 0.85, ease: ease.outBack, d: 0.55 });

        // S4
        s4Head.update(t, 20.6, 25.15);
        vis(map.wrap, t, 20.7, 25.2, { y: 0, s: 1.04, d: 1.2, ease: ease.outCubic });
        const rp = prog(t, 21.1, 1.6, ease.inOutCubic);
        rt.set(rp);
        stopEls.forEach(({ g, at }) => g.setAttribute("opacity", (clamp((rp - at + 0.04) / 0.04) * clamp((t - 21.1) / 0.25)).toFixed(3)));
        vis(offer, t, 21.4, 25.2, { x: 60, y: 0 });
        vis(hired, t, 22.4, 25.2, { x: 60, y: 0 });
        vis(s4Sub, t, 23.2, 25.15);
      };
    },
  };
})();
