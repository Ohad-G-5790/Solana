// b4 — Five musicians. Rusty Pilots, hip-hop, 3,500 a night: big rooms -> no fee stack -> 15,500 tickets in escrow -> one-transaction settlement.
(() => {
  const { vis, prog, ease, clamp, lerp, h, fmt } = GR;
  const { S, makePhone, pane, paneVis, add, title, progRow, splitBar, sceneText, tag, eur } = PK;

  const SHOWS = [
    { city: "Berlin", venue: "Columbiahalle", cap: 3500 },
    { city: "Prague", venue: "Forum Karlín", cap: 3000 },
    { city: "Leipzig", venue: "Haus Auensee", cap: 2500 },
    { city: "Dresden", venue: "Reithalle Straße E", cap: 2500 },
    { city: "Munich", venue: "TonHalle München", cap: 2000 },
    { city: "Cologne", venue: "E-Werk", cap: 2000 },
  ];
  const TOTAL = SHOWS.reduce((n, s) => n + s.cap, 0);
  const PRICE = 45;

  window.VIDEO = {
    tag: tag("Musicians ", 4, "Big act"),
    kicker: "Rusty Pilots · hip-hop",
    punch: "Big rooms.\n{g:Simple math.}",
    build(stage) {
      const ph = makePhone(stage, { me: "RP" });

      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Hip-hop · 3,500 a night", lc: "g", head: "We sell out\n{g:3,500-cap rooms.}" });
      const p1 = pane(ph);
      title(p1, "Winter tour", "6 shows · sold out");
      const rows = SHOWS.map((s) => ({ s, r: progRow(p1, { name: `${s.city} <span style="color:#8a8a8a;font-weight:500;font-size:24px">· ${s.venue}</span>`, cap: s.cap }) }));

      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], head: "Our fans used to pay\n{r:27% on top.}", sub: "Now they pay the ticket. The network fee is cents." });
      const p2 = pane(ph);
      title(p2, "One ticket", "Berlin · Columbiahalle");
      const before = add(p2, "prow", `<div class="k">Before · example checkout</div>
        <div class="row between" style="margin-top:12px"><span>Ticket</span><b>€45.00</b></div>
        <div class="row between" style="margin-top:6px"><span>Fees</span><b style="color:var(--negative)">+ €12.15</b></div>
        <div class="row between" style="margin-top:12px;font-size:34px"><span>Fan pays</span><b style="color:var(--negative)">€57.15</b></div>`);
      const after = add(p2, "prow", `<div class="k">With Greenroom</div>
        <div class="row between" style="margin-top:12px"><span>Ticket</span><b>€45.00</b></div>
        <div class="row between" style="margin-top:6px"><span>Network fee</span><b style="color:var(--accent)">cents</b></div>
        <div class="row between" style="margin-top:12px;font-size:34px"><span>Fan pays</span><b style="color:var(--accent)">€45.00</b></div>`, { boxShadow: "inset 0 0 0 3px var(--accent)" });
      const foot2 = add(p2, "", "27%: average primary-market fee in the events reviewed by the U.S. GAO (GAO-18-347, 2018).", { fontSize: 20, color: "#8a8a8a", lineHeight: 1.35, marginTop: 4 });

      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: `${fmt(TOTAL)} tickets.\n{g:Every one in escrow.}` });
      const p3 = pane(ph);
      title(p3, "Live", "All 6 shows");
      const tiles = add(p3, "row", "", { gap: "18px" });
      const tile = (k) => {
        const e = h("div", "prow", `<div class="k">${k}</div><div class="big n" style="font-size:58px">0</div>`, { flex: 1 });
        tiles.appendChild(e);
        return e.querySelector(".n");
      };
      const nT = tile("Tickets");
      const nE = tile("In escrow");
      const lanes = SHOWS.map((s) => add(p3, "", `<div class="row between" style="font-size:24px"><span>${s.city}</span><b class="v num"></b></div><div style="height:16px;border-radius:9999px;background:#262626;margin-top:8px;overflow:hidden"><div class="f" style="height:100%;border-radius:9999px;background:var(--accent)"></div></div>`));

      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], label: "Berlin settles", lc: "g", head: "{g:One transaction.}\nNo expense sheets." });
      const p4 = pane(ph);
      title(p4, "Berlin · Columbiahalle", `3,500 tickets × €45 = ${eur(3500 * PRICE)}`);
      const card = add(p4, "prow");
      const sb = splitBar(card, [
        { label: "Rusty Pilots · 73%", pct: 73, color: "var(--accent)", amount: eur(3500 * PRICE * 0.73) },
        { label: "Columbiahalle · 27%", pct: 27, color: "#e6e6e6", amount: eur(3500 * PRICE * 0.27) },
      ], { hgt: 56, mt: 0 });
      const done = add(p4, "prow row", `<span style="flex:none;width:56px;height:56px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span style="font-size:30px">Settled on Solana · split exactly as signed</span>`, { gap: "22px" });

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[2][0] ? "13:00" : t < S[3][0] ? "19:30" : "00:20");

        t1(t);
        paneVis(p1, t, 0.5, S[0][1]);
        rows.forEach(({ s, r }, i) => {
          vis(r.el, t, 1.0 + i * 0.15, null, { y: 20, d: 0.5 });
          const sold = s.cap * prog(t, 1.4 + i * 0.15, 3.0, ease.outCubic);
          r.set({ sold, state: sold >= s.cap / 2 ? "confirmed" : "onSale", right: sold >= s.cap - 0.5 ? "sold out" : "" });
        });

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        vis(before, t, 7.0, null, { y: 20, d: 0.5 });
        vis(after, t, 8.6, null, { y: 20, d: 0.5 });
        vis(foot2, t, 9.6, null, { y: 10, d: 0.5 });

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        const lp = prog(t, 13.4, 3.6, ease.inOutSine);
        nT.textContent = fmt(Math.round(TOTAL * lp));
        nE.textContent = eur(TOTAL * PRICE * lp);
        lanes.forEach((e, i) => {
          vis(e, t, 13.3 + i * 0.12, null, { y: 16, d: 0.5 });
          const p = prog(t, 13.5 + i * 0.12, 3.4, ease.inOutSine);
          e.querySelector(".f").style.width = `${p * 100}%`;
          e.querySelector(".v").textContent = `${fmt(Math.round(SHOWS[i].cap * p))} / ${fmt(SHOWS[i].cap)}`;
        });

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        vis(card, t, 19.8, null, { y: 20, d: 0.5 });
        sb.set(prog(t, 20.1, 1.0, ease.inOutCubic), t, 20.7);
        vis(done, t, 22.0, null, { y: 20, d: 0.5 });
      };
    },
  };
})();
