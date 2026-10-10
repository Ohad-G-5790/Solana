// a2 — One band, one tour. Chapter 2: Book. My terms -> best offer per city -> venue signs -> terms locked.
(() => {
  const { vis, prog, ease, clamp, h } = GR;
  const { S, makePhone, pane, paneVis, add, title, badge, splitBar, notifStack, sceneText } = PK;

  window.VIDEO = {
    kicker: "Chapter 2 · Book",
    punch: "My tour.\n{g:My terms.}",
    build(stage) {
      const ph = makePhone(stage, { me: "CR" });

      // S1: my terms
      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Before anything is signed", lc: "g", head: "I set the terms.\n{g:My agent holds the line.}" });
      const p1 = pane(ph);
      title(p1, "My terms", "Every show on this tour.");
      const TERMS = [
        ["Ticket price", "€25"],
        ["Sell-through threshold", "50%"],
        ["Deadline", "3 weeks before each show"],
        ["Default split", "Band 70% · Venue 30%"],
      ];
      const terms = TERMS.map(([k, v]) => add(p1, "prow", `<div class="k">${k}</div><div style="font-size:36px;font-weight:800;color:#fff;margin-top:6px">${v}</div>`));

      // S2: compare offers
      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], head: "Every offer gets compared.\n{g:The best one per city wins.}" });
      const p2 = pane(ph);
      title(p2, "Prague", "4 venues answered · Nov 6–9");
      const OFFERS = [
        ["Palác Akropolis", "cap 500 · 30% to venue · Nov 7 free", "Fits the route", true],
        ["MeetFactory", "cap 750 · 30% to venue · Nov 12 free", "Date breaks the route", false],
        ["Lucerna Music Bar", "declined · 800-cap room is too big", "", false],
        ["Roxy", "declined · rock is off their programme", "", false],
      ];
      const offers = OFFERS.map(([n, s, note, pick]) => {
        const e = add(p2, "prow", `<div class="row between"><b style="font-size:30px">${n}</b><span class="tagx"></span></div><div style="font-size:24px;color:#b3b3b3;margin-top:6px">${s}</div>${note ? `<div style="font-size:22px;margin-top:8px;color:${pick ? "var(--accent)" : "#8a8a8a"}">${note}</div>` : ""}`);
        return { e, pick, tg: e.querySelector(".tagx"), dim: s.startsWith("declined") };
      });

      // S3: the venue signs
      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "The venue signs.\n{g:On-chain.}", sub: "Tickets go on sale the moment they do." });
      const p3 = pane(ph);
      title(p3, "Shows", "Proposed by my agent");
      const SHOWS = [
        ["Berlin", "Lido · Nov 3"],
        ["Leipzig", "Conne Island · Nov 4"],
        ["Dresden", "Beatpol · Nov 5"],
        ["Prague", "Palác Akropolis · Nov 7"],
        ["Brno", "Metro Music Bar · Nov 8"],
      ];
      const shows = SHOWS.map(([c, s], i) => {
        const e = add(p3, "prow row between", `<div><b style="font-size:30px">${c}</b><div style="font-size:23px;color:#b3b3b3;margin-top:4px">${s}</div></div><span class="b"></span>`);
        return { e, b: e.querySelector(".b"), at: 14.2 + i * 0.55, last: null };
      });
      const n3 = notifStack(stage, 64, 1240, 952, [{ at: 14.4, title: "Lido signed · Berlin, Nov 3", body: "accept_show is on Solana. Tickets are on sale." }]);

      // S4: locked terms
      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "Price, threshold, split:\n{g:locked in the program.}" });
      const p4 = pane(ph);
      title(p4, "Deal · Berlin, Nov 3", "Lido · 400 tickets");
      const DEAL = [
        ["Ticket", "€25"],
        ["Threshold", "50% · 200 tickets"],
        ["Deadline", "Oct 13"],
      ];
      const deal = DEAL.map(([k, v]) => add(p4, "prow row between", `<span style="color:#b3b3b3">${k}</span><b style="font-size:32px">${v}</b>`, { padding: "22px 28px" }));
      const splitCard = add(p4, "prow", `<div class="k">Split</div>`);
      const sb = splitBar(splitCard, [
        { label: "Band", pct: 70, color: "var(--accent)", amount: "70%" },
        { label: "Lido", pct: 30, color: "#e6e6e6", amount: "30%" },
      ], { hgt: 48, mt: 14 });
      const lock = add(p4, "row", `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1ed760" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span style="font-size:27px;color:#e6e6e6">Stored on Solana. Nobody can quietly change it.</span>`, { gap: "18px", marginTop: 10 });

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[2][0] ? "10:05" : "10:31");

        t1(t);
        paneVis(p1, t, 0.5, S[0][1]);
        terms.forEach((e, i) => vis(e, t, 1.2 + i * 0.45, null, { y: 24, d: 0.5 }));

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        offers.forEach(({ e, pick, tg, dim }, i) => {
          vis(e, t, 7.0 + i * 0.4, null, { y: 24, d: 0.5, max: dim ? 0.6 : 1 });
          const on = t > 9.9;
          if (pick) {
            const p = prog(t, 9.9, 0.4);
            e.style.boxShadow = `inset 0 0 0 ${(3 * p).toFixed(2)}px var(--accent)`;
            tg.innerHTML = on ? `<span class="pill g" style="font-size:20px;padding:6px 16px">Picked</span>` : "";
          }
        });

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        shows.forEach((s, i) => {
          vis(s.e, t, 13.1 + i * 0.18, null, { y: 20, d: 0.5 });
          const st = t >= s.at ? "onSale" : "proposed";
          if (st !== s.last) {
            s.b.innerHTML = badge(st);
            s.last = st;
          }
          s.e.style.boxShadow = t >= s.at ? `inset 0 0 0 ${(3 * (1 - prog(t, s.at, 0.8))).toFixed(2)}px var(--info)` : "none";
        });
        n3(t, 17.6);

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        deal.forEach((e, i) => vis(e, t, 19.7 + i * 0.3, null, { y: 20, d: 0.5 }));
        vis(splitCard, t, 20.6, null, { y: 20, d: 0.5 });
        sb.set(prog(t, 20.9, 0.9, ease.inOutCubic), t, 21.4);
        vis(lock, t, 22.3, null, { y: 16, d: 0.5 });
      };
    },
  };
})();
