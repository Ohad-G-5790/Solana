// b1 — Five musicians. Lena, solo, 150 a night: no booker -> books six small rooms -> 75 tickets confirms -> paid.
(() => {
  const { vis, prog, ease, clamp, h, fmt } = GR;
  const { S, makePhone, pane, paneVis, add, title, progRow, splitBar, notifStack, sceneText, tag, eur } = PK;

  const SHOWS = [
    { city: "Brno", venue: "Kabinet múz", sold: 146 },
    { city: "Nuremberg", venue: "Club Stereo", sold: 131 },
    { city: "Frankfurt", venue: "Nachtleben", sold: 150 },
    { city: "Innsbruck", venue: "p.m.k", sold: 118 },
    { city: "Plzeň", venue: "Anděl Music Bar", sold: 139 },
    { city: "Linz", venue: "KAPU", sold: 61 },
  ];
  const PRICE = 18;
  // First tour, no on-chain record: venue agents ask 35% (packages/agents/src/venue-agent.ts).
  const TOUR_TAKE = SHOWS.filter((s) => s.sold >= 75).reduce((n, s) => n + s.sold * PRICE * 0.65, 0);

  window.VIDEO = {
    tag: tag("Musicians ", 1, "Solo"),
    kicker: "Lena · solo artist",
    punch: "No booker needed.\n{g:I have an agent.}",
    build(stage) {
      const ph = makePhone(stage, { me: "L" });
      const appbar = ph.el.querySelector(".ph-appbar");

      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Solo · 150 a night", lc: "r", head: "I'm Lena. I play\nto {r:150 people} a night.", sub: "No booker wants an act my size." });
      const p1 = pane(ph);
      p1.style.top = "-96px";
      add(p1, "pt", "Inbox");
      const MAIL = [
        ["AG", "Agency · Berlin", "Not taking on new artists this year."],
        ["AG", "Agency · Vienna", "We only book acts drawing 500+."],
        ["VF", "Venue · Frankfurt", "Room hire €400, paid upfront."],
        ["AG", "Agency · Prague", "Sorry, your draw is too small for us."],
      ];
      const mails = MAIL.map(([i, w, s]) =>
        add(p1, "prow row", `<div style="flex:none;width:64px;height:64px;border-radius:50%;background:#2e2e2e;color:#cbcbcb;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center">${i}</div><div style="flex:1;min-width:0"><b style="font-size:28px">${w}</b><div style="font-size:24px;color:#b3b3b3">${s}</div></div>`, { gap: "22px" }),
      );

      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], label: "With Greenroom", lc: "g", head: "So I booked {g:my own tour.}\nFrom my phone." });
      const p2 = pane(ph);
      title(p2, "6 offers", "Brief: 6 shows · small rooms · I draw 150 · €18");
      const offers = SHOWS.map((s) => add(p2, "prow row between", `<span><b>${s.venue}</b> <span style="color:#b3b3b3">· ${s.city}</span></span><span style="color:var(--accent);font-weight:700">150 · 35%</span>`, { padding: "20px 26px" }));

      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "At {g:75 tickets}, it's on.\nBelow that: refunds.", sub: "I never paid a deposit." });
      const p3 = pane(ph);
      title(p3, "My shows", "Threshold: 75 of 150");
      const rows = SHOWS.map((s) => ({ s, r: progRow(p3, { name: s.city, cap: 150 }) }));

      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "Brno: 146 people.\n{g:€1,708 to me.}" });
      const p4 = pane(ph);
      title(p4, "Brno · Kabinet múz", "146 tickets × €18 = €2,628");
      const card = add(p4, "prow");
      const sb = splitBar(card, [
        { label: "Me · 65%", pct: 65, color: "var(--accent)", amount: "€1,708" },
        { label: "Kabinet múz · 35%", pct: 35, color: "#e6e6e6", amount: "€920" },
      ], { hgt: 56, mt: 0 });
      const tot = add(p4, "prow", `<div class="k">This tour · 5 shows</div><div class="big n">€0</div>`);
      const totN = tot.querySelector(".n");

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[1][0] ? "22:16" : t < S[3][0] ? "10:40" : "09:05");
        appbar.style.opacity = clamp((t - S[1][0] - 0.2) / 0.4).toFixed(3);

        t1(t);
        vis(p1, t, 0.6, S[0][1], { y: 0, d: 0.3, ox: -110, oy: 0 });
        mails.forEach((m, i) => vis(m, t, 1.0 + i * 0.5, null, { y: -24, d: 0.45, ease: ease.outCubic }));

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        offers.forEach((o, i) => vis(o, t, 7.2 + i * 0.4, null, { x: 40, y: 0, d: 0.5 }));

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        rows.forEach(({ s, r }, i) => {
          vis(r.el, t, 13.2 + i * 0.12, null, { y: 20, d: 0.5 });
          const sold = s.sold * prog(t, 13.6 + i * 0.1, 3.2, ease.outCubic);
          const state = sold >= 75 ? "confirmed" : t > 17.4 ? "cancelled" : "onSale";
          r.set({ sold, state, right: state === "cancelled" ? "refunded" : "" });
        });

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        vis(card, t, 19.8, null, { y: 20, d: 0.5 });
        sb.set(prog(t, 20.1, 0.9, ease.inOutCubic), t, 20.6);
        vis(tot, t, 21.8, null, { y: 20, d: 0.5 });
        totN.textContent = eur(TOUR_TAKE * prog(t, 22.1, 1.6, ease.outCubic));
      };
    },
  };
})();
