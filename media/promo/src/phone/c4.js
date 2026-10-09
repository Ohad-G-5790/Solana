// c4 — Small vs big. Payday: different rooms -> paid in one transaction -> the split follows the record -> nobody skims.
(() => {
  const { vis, prog, ease, clamp, h, fmt } = GR;
  const { S, pane, paneVis, add, bigTitle: title, duo, duoText, bigCard, bigRow, splitBar, tag, eur, LENA, RUSTY } = PK;

  // Lena: first tour, venue asks 35% -> 65% of 146 x EUR 18. Rusty Pilots: strong record, venue asks 27% -> 73% of 3,500 x EUR 45.
  const LG = 146 * 18;
  const RG = 3500 * 45;

  window.VIDEO = {
    tag: tag("Small or big ", 4, "Payday"),
    kicker: "Small or big · Payday",
    punch: "Small or big,\n{g:same rules.}",
    build(stage) {
      const d = duo(stage, LENA, RUSTY);
      const both = (fn) => [fn(d.L, LENA, 0), fn(d.R, RUSTY, 1)];
      const sc = (i, L, R, foot) => duoText(stage, { a: S[i][0], b: S[i][1], L, R, foot });

      const t1 = sc(0, "Brno:\n{g:146 tickets.}", "Berlin:\n{g:3,500 tickets.}", "Different rooms.");
      const p1 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Ticket sales");
        const L = a === LENA;
        return { p, c: bigCard(p, L ? "Brno" : "Berlin", "€0", { size: L ? 110 : 92, note: L ? "146 × €18" : "3,500 × €45" }), to: L ? LG : RG };
      });

      const t2 = sc(1, "{g:€1,708}\nto me.", "{g:€114,975}\nto us.", "Paid the morning after,\n{g:in one transaction.}");
      const p2 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Wallet");
        const L = a === LENA;
        return { p, c: bigCard(p, "Received", "+€0", { size: L ? 110 : 88, color: "var(--accent)", note: "settled on Solana" }), to: L ? LG * 0.65 : RG * 0.73 };
      });

      const t3 = sc(2, "My split:\n{g:65 / 35.}", "Ours:\n{g:73 / 27.}", "Record, not size,\n{g:sets the split.}");
      const p3 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Split");
        const L = a === LENA;
        const card = add(p, "prow", `<div class="k" style="font-size:30px">${L ? "First tour · no record" : "40 shows on record"}</div>`, { padding: "30px 34px" });
        const sb = splitBar(card, L
          ? [{ label: "Me", pct: 65, color: "var(--accent)", amount: "65%" }, { label: "Venue", pct: 35, color: "#e6e6e6", amount: "35%" }]
          : [{ label: "Us", pct: 73, color: "var(--accent)", amount: "73%" }, { label: "Venue", pct: 27, color: "#e6e6e6", amount: "27%" }], { hgt: 70, mt: 20, fs: 42 });
        return { p, card, sb };
      });

      const t4 = sc(3, "No booker's\n{g:cut.}", "No expense\n{g:sheet.}", "Nobody skims,\n{g:at any size.}");
      const p4 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Deductions");
        const rows = a === LENA ? [["Booker", "€0"], ["Deposit", "€0"], ["Fees", "cents"]] : [["Promoter", "€0"], ["Expenses", "none"], ["Fees", "cents"]];
        return { p, rows: rows.map(([l, r]) => bigRow(p, l, r)) };
      });

      return (t) => {
        d.show(t);
        [d.L, d.R].forEach((ph) => ph.setTime(t < S[1][0] ? "23:40" : "08:15"));

        t1(t);
        p1.forEach(({ p, c, to }, k) => {
          paneVis(p, t, 0.6 + k * 0.15, S[0][1]);
          vis(c, t, 1.2 + k * 0.15, null, { y: 20, d: 0.5 });
          c.querySelector(".n").textContent = eur(to * prog(t, 1.5 + k * 0.15, 2.6, ease.inOutSine));
        });

        t2(t);
        p2.forEach(({ p, c, to }, k) => {
          paneVis(p, t, S[1][0] + 0.1 + k * 0.15, S[1][1]);
          vis(c, t, 7.0 + k * 0.15, null, { y: 20, d: 0.5 });
          c.querySelector(".n").textContent = `+${eur(to * prog(t, 7.4 + k * 0.15, 1.8, ease.outCubic))}`;
        });

        t3(t);
        p3.forEach(({ p, card, sb }, k) => {
          paneVis(p, t, S[2][0] + 0.1 + k * 0.15, S[2][1]);
          vis(card, t, 13.3 + k * 0.15, null, { y: 20, d: 0.5 });
          sb.set(prog(t, 13.7 + k * 0.15, 1.0, ease.inOutCubic), t, 14.3 + k * 0.15);
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
