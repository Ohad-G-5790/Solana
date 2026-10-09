// b3 — Five musicians. The Broken Tides, indie, 600 a night: a record on-chain -> venues ask less -> +€1,344 a night.
(() => {
  const { vis, prog, ease, clamp, lerp, h, fmt } = GR;
  const { S, makePhone, pane, paneVis, add, title, splitBar, sceneText, eur } = PK;

  // 600 tickets x EUR 28 = EUR 16,800. Venue-agent pricing in the app: 35% for a band with
  // no history, 27% for a strong record (3+ settled shows averaging at least half the draw).
  const GROSS = 600 * 28;

  window.VIDEO = {
    kicker: "The Broken Tides · indie",
    punch: "Our record\n{g:pays us back.}",
    build(stage) {
      const ph = makePhone(stage, { me: "BT" });

      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Indie band · 600 a night", lc: "g", head: "We've played\n{g:14 Greenroom shows.}", sub: "Every one settled on-chain." });
      const p1 = pane(ph);
      title(p1, "Band record", "On-chain · anyone can check it");
      const tiles = add(p1, "row", "", { gap: "18px" });
      const tile = (k) => {
        const e = h("div", "prow", `<div class="k">${k}</div><div class="big n" style="font-size:60px">0</div>`, { flex: 1 });
        tiles.appendChild(e);
        return e.querySelector(".n");
      };
      const nS = tile("Shows");
      const nT = tile("Tickets");
      const nA = tile("Avg / show");
      const PAST = [["Werk 2", "Leipzig", "612"], ["Lucerna Music Bar", "Prague", "588"], ["Flex", "Vienna", "601"], ["Fléda", "Brno", "540"]];
      const past = PAST.map(([v, c, n]) => add(p1, "prow row between", `<span><b>${v}</b> <span style="color:#b3b3b3">· ${c}</span></span><span><span style="color:#b3b3b3">${n} sold</span> <span class="badge settled" style="font-size:20px;margin-left:8px">settled</span></span>`, { padding: "20px 26px" }));

      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], head: "Venues can check that.\n{g:So they ask for less.}" });
      const p2 = pane(ph);
      title(p2, "What venues ask", "Venue agents read our record before they offer.");
      const then = add(p2, "prow", `<div class="k">Our first tour · no record</div><div class="row between" style="margin-top:10px"><span style="font-size:30px">Venue share</span><b style="font-size:48px;color:var(--negative)">35%</b></div>`);
      const now = add(p2, "prow", `<div class="k">Now · 14 shows settled</div><div class="row between" style="margin-top:10px"><span style="font-size:30px">Venue share</span><b style="font-size:48px;color:var(--accent)">27%</b></div>`);
      const OFF = [["Werk 2 · Leipzig", "strong track record · 27%"], ["Lucerna Music Bar · Prague", "strong track record · 27%"]];
      const offs = OFF.map(([a, b]) => add(p2, "prow", `<b>${a}</b><div style="font-size:23px;color:var(--accent);margin-top:4px">${b}</div>`, { padding: "20px 26px" }));

      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "Same room, same tickets.\n{g:+€1,344 a night.}" });
      const p3 = pane(ph);
      title(p3, "One night · Werk 2", `600 tickets × €28 = ${eur(GROSS)}`);
      const c1 = add(p3, "prow", `<div class="k">First tour · venue 35%</div>`);
      const s1 = splitBar(c1, [
        { label: "Us · 65%", pct: 65, color: "#cbcbcb", amount: eur(GROSS * 0.65) },
        { label: "Venue · 35%", pct: 35, color: "#3a3a3a", amount: eur(GROSS * 0.35) },
      ], { hgt: 44, mt: 12 });
      const c2 = add(p3, "prow", `<div class="k">Now · venue 27%</div>`);
      const s2 = splitBar(c2, [
        { label: "Us · 73%", pct: 73, color: "var(--accent)", amount: eur(GROSS * 0.73) },
        { label: "Venue · 27%", pct: 27, color: "#3a3a3a", amount: eur(GROSS * 0.27) },
      ], { hgt: 44, mt: 12 });

      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "10 shows this tour.\n{g:+€13,440}, same rooms." });
      const p4 = pane(ph);
      title(p4, "Spring tour", "10 shows · 600 a night · €28");
      const big = add(p4, "prow", `<div class="k">More to us than our first tour</div><div class="big n" style="font-size:110px;color:var(--accent)">+€0</div><div style="font-size:24px;color:#b3b3b3;margin-top:6px">10 shows × €1,344</div>`);
      const bigN = big.querySelector(".n");
      const dots = add(p4, "row", Array.from({ length: 10 }, () => `<span class="d" style="flex:1;height:56px;border-radius:14px;background:#262626"></span>`).join(""), { gap: "10px" });
      const ds = [...dots.querySelectorAll(".d")];

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[2][0] ? "16:30" : "16:42");

        t1(t);
        paneVis(p1, t, 0.5, S[0][1]);
        const np = prog(t, 1.0, 2.2, ease.outCubic);
        nS.textContent = Math.round(14 * np);
        nT.textContent = fmt(Math.round(7826 * np));
        nA.textContent = Math.round(559 * np);
        past.forEach((e, i) => vis(e, t, 2.0 + i * 0.35, null, { y: 20, d: 0.5 }));

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        vis(then, t, 7.0, null, { y: 20, d: 0.5, max: 0.75 });
        vis(now, t, 8.2, null, { y: 20, d: 0.5 });
        offs.forEach((e, i) => vis(e, t, 9.4 + i * 0.4, null, { x: 40, y: 0, d: 0.5 }));

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        vis(c1, t, 13.3, null, { y: 20, d: 0.5 });
        s1.set(prog(t, 13.6, 0.9, ease.inOutCubic), t, 14.1);
        vis(c2, t, 15.0, null, { y: 20, d: 0.5 });
        s2.set(prog(t, 15.3, 0.9, ease.inOutCubic), t, 15.8);

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        vis(big, t, 19.8, null, { y: 20, d: 0.5 });
        vis(dots, t, 20.2, null, { y: 20, d: 0.5 });
        const k = prog(t, 20.4, 2.6, ease.linear) * 10;
        ds.forEach((d, i) => (d.style.background = i < k ? "var(--accent)" : "#262626"));
        bigN.textContent = `+${eur(1344 * Math.min(10, Math.floor(k + 0.0001)))}`;
      };
    },
  };
})();
