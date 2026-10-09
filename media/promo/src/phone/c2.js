// c2 — Small vs big. Threshold: same 50% rule -> both confirmed -> both refund a miss -> nobody loses a deposit.
(() => {
  const { vis, prog, ease, clamp } = GR;
  const { S, pane, paneVis, add, bigTitle: title, duo, duoText, bigCard, bigRow, bigProg, tag, LENA, RUSTY } = PK;

  window.VIDEO = {
    tag: tag("Small or big ", 2, "Threshold"),
    kicker: "Small or big · Threshold",
    punch: "One rule\n{g:for every stage.}",
    build(stage) {
      const d = duo(stage, LENA, RUSTY);
      const both = (fn) => [fn(d.L, LENA, 0), fn(d.R, RUSTY, 1)];
      const sc = (i, L, R, foot) => duoText(stage, { a: S[i][0], b: S[i][1], L, R, foot });

      const t1 = sc(0, "I need {g:75}\nper show.", "We need\n{g:1,750.}", "Same rule:\n{g:50% by the deadline.}");
      const p1 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Threshold");
        return { p, cards: [bigCard(p, "Sell-through", "50%"), bigCard(p, "Per show", a === LENA ? "75" : "1,750", { note: a === LENA ? "of 150" : "of 3,500" })] };
      });

      const t2 = sc(1, "Brno:\n{g:confirmed.}", "Berlin:\n{g:confirmed.}", "Hit it,\n{g:the show is on.}");
      const p2 = both((ph, a) => {
        const p = pane(ph);
        title(p, a === LENA ? "Brno" : "Berlin");
        return { p, r: bigProg(p, { name: a === LENA ? "Kabinet múz" : "Columbiahalle", cap: a.cap }), to: a === LENA ? 146 : 3500 };
      });

      const t3 = sc(2, "Linz\n{r:missed.}", "Hannover\n{r:missed.}", "Miss it,\n{g:every fan is refunded.}");
      const p3 = both((ph, a) => {
        const p = pane(ph);
        title(p, a === LENA ? "Linz" : "Hannover");
        const cap = a === LENA ? 150 : 1800;
        const sold = a === LENA ? 61 : 731;
        const r = bigProg(p, { name: a === LENA ? "KAPU" : "Capitol", cap });
        const ref = bigCard(p, "Refunded", "0", { color: "var(--accent)", size: 96 });
        return { p, r, ref, sold };
      });

      const t4 = sc(3, "I lost\n{g:nothing.}", "Neither\n{g:did we.}", "No deposits.\n{g:No empty rooms.}");
      const p4 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Cost of a miss");
        return { p, rows: [bigRow(p, "Deposit", "€0"), bigRow(p, "Empty room", "none"), bigRow(p, "Fans", "refunded")] };
      });

      return (t) => {
        d.show(t);
        [d.L, d.R].forEach((ph) => ph.setTime(t < S[2][0] ? "12:00" : "09:00"));

        t1(t);
        p1.forEach(({ p, cards }, k) => {
          paneVis(p, t, 0.6 + k * 0.15, S[0][1]);
          cards.forEach((c, i) => vis(c, t, 1.4 + i * 0.6 + k * 0.15, null, { y: 20, d: 0.5 }));
        });

        t2(t);
        p2.forEach(({ p, r, to }, k) => {
          paneVis(p, t, S[1][0] + 0.1 + k * 0.15, S[1][1]);
          vis(r.el, t, 7.0 + k * 0.15, null, { y: 20, d: 0.5 });
          const sold = to * prog(t, 7.4 + k * 0.15, 3.0, ease.inOutSine);
          const need = k ? 1750 : 75;
          r.set({ sold, state: sold >= need ? "confirmed" : "onSale", note: sold >= need ? "the show is on" : `need ${need.toLocaleString("en-US")}` });
        });

        t3(t);
        p3.forEach(({ p, r, ref, sold }, k) => {
          paneVis(p, t, S[2][0] + 0.1 + k * 0.15, S[2][1]);
          vis(r.el, t, 13.4 + k * 0.15, null, { y: 20, d: 0.5 });
          const cancelled = t > 14.6 + k * 0.15;
          r.set({ sold, state: cancelled ? "cancelled" : "onSale", note: cancelled ? "deadline passed" : "deadline today" });
          vis(ref, t, 15.0 + k * 0.15, null, { y: 20, d: 0.5 });
          ref.querySelector(".n").textContent = Math.round(sold * prog(t, 15.3 + k * 0.15, 2.0, ease.inOutSine)).toLocaleString("en-US");
        });

        t4(t);
        p4.forEach(({ p, rows }, k) => {
          paneVis(p, t, S[3][0] + 0.1 + k * 0.15, S[3][1]);
          rows.forEach((r, i) => vis(r, t, 19.9 + i * 0.4 + k * 0.15, null, { y: 20, d: 0.5 }));
        });
      };
    },
  };
})();
