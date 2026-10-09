// c3 — Small vs big. Every ticket: live sales -> money waits in escrow -> which city buys -> anyone can read it.
(() => {
  const { vis, prog, ease, clamp, h, fmt } = GR;
  const { S, pane, paneVis, add, bigTitle: title, duo, duoText, bigCard, bigRow, tag, eur, LENA, RUSTY } = PK;

  const LC = [["Frankfurt", 150], ["Brno", 146], ["Plzeň", 139], ["Nuremberg", 131], ["Innsbruck", 118]];
  const RC = [["Berlin", 3500], ["Prague", 3000], ["Leipzig", 2500], ["Dresden", 2500], ["Cologne", 2000]];

  window.VIDEO = {
    tag: tag("Small or big ", 3, "Every ticket"),
    kicker: "Small or big · Every ticket",
    punch: "Small or big,\n{g:nothing is hidden.}",
    build(stage) {
      const d = duo(stage, LENA, RUSTY);
      const both = (fn) => [fn(d.L, LENA, 0), fn(d.R, RUSTY, 1)];
      const sc = (i, L, R, foot) => duoText(stage, { a: S[i][0], b: S[i][1], L, R, foot });

      const t1 = sc(0, "I watch my\n{g:150} sell.", "We watch\n{g:15,500.}", "Every ticket,\n{g:live.}");
      const p1 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Live");
        const c = bigCard(p, a === LENA ? "Brno · sold" : "Tour · sold", "0");
        const B = a === LENA ? [["+1", "Brno"], ["+2", "Brno"], ["+1", "Brno"]] : [["+4", "Berlin"], ["+6", "Prague"], ["+2", "Cologne"]];
        return { p, c, to: a === LENA ? 146 : 15500, rows: B.map(([q, n]) => bigRow(p, `<span style="color:var(--accent)">${q}</span> ${n}`, "now", { color: "#8a8a8a" })) };
      });

      const t2 = sc(1, "Brno: {g:€2,628}\nin escrow.", "Berlin:\n{g:€157,500.}", "Money waits in escrow,\n{g:not with a middleman.}");
      const p2 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Escrow");
        const c = bigCard(p, a === LENA ? "Brno" : "Berlin", "€0", { size: a === LENA ? 110 : 92, note: "held by the program" });
        const r = bigRow(p, "Released", "after the show", { color: "#b3b3b3" });
        return { p, c, r, to: a === LENA ? 146 * 18 : 3500 * 45 };
      });

      const t3 = sc(2, "I see which\n{g:city buys.}", "So do\n{g:we.}", "Plan the next tour from\n{g:real numbers.}");
      const p3 = both((ph, a) => {
        const p = pane(ph);
        title(p, "By city");
        const rows = a === LENA ? LC : RC;
        const max = rows[0][1];
        const items = rows.map(([n, v]) => {
          const e = add(p, "", `<div class="row between" style="font-size:40px"><span>${n}</span><b class="v num"></b></div><div style="height:26px;border-radius:9999px;background:#262626;margin-top:12px;overflow:hidden"><div class="f" style="height:100%;border-radius:9999px;background:var(--accent)"></div></div>`, { marginBottom: 8 });
          return { e, v, max, f: e.querySelector(".f"), t: e.querySelector(".v") };
        });
        return { p, items };
      });

      const t4 = sc(3, "My venue\n{g:sees it too.}", "So does\n{g:our manager.}", "One record of the truth:\n{g:on Solana.}");
      const p4 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Show · public");
        const L = a === LENA;
        const rows = [bigRow(p, "Price", L ? "€18" : "€45", { color: "#fff" }), bigRow(p, "Sold", L ? "146" : "3,500", { color: "#fff" }), bigRow(p, "Escrow", L ? "€2,628" : "€157,500", { color: "#fff" }), bigRow(p, "Split", L ? "65 / 35" : "73 / 27", { color: "#fff" })];
        const pill = add(p, "pill g", "Anyone can read it", { fontSize: 34, alignSelf: "flex-start", padding: "14px 28px", marginTop: 6 });
        return { p, rows, pill };
      });

      return (t) => {
        d.show(t);
        [d.L, d.R].forEach((ph) => ph.setTime(t < S[3][0] ? "19:10" : "09:40"));

        t1(t);
        p1.forEach(({ p, c, to, rows }, k) => {
          paneVis(p, t, 0.6 + k * 0.15, S[0][1]);
          vis(c, t, 1.2 + k * 0.15, null, { y: 20, d: 0.5 });
          c.querySelector(".n").textContent = fmt(Math.round(to * prog(t, 1.5 + k * 0.15, 4.0, ease.inOutSine)));
          rows.forEach((r, i) => vis(r, t, 2.2 + i * 0.7 + k * 0.2, null, { y: -20, d: 0.45 }));
        });

        t2(t);
        p2.forEach(({ p, c, r, to }, k) => {
          paneVis(p, t, S[1][0] + 0.1 + k * 0.15, S[1][1]);
          vis(c, t, 7.0 + k * 0.15, null, { y: 20, d: 0.5 });
          c.querySelector(".n").textContent = eur(to * prog(t, 7.3 + k * 0.15, 3.0, ease.inOutSine));
          vis(r, t, 9.4 + k * 0.15, null, { y: 20, d: 0.5 });
        });

        t3(t);
        p3.forEach(({ p, items }, k) => {
          paneVis(p, t, S[2][0] + 0.1 + k * 0.15, S[2][1]);
          items.forEach(({ e, v, max, f, t: tx }, i) => {
            vis(e, t, 13.3 + i * 0.2 + k * 0.15, null, { y: 16, d: 0.45 });
            const pp = prog(t, 13.6 + i * 0.2 + k * 0.15, 1.4, ease.outCubic);
            f.style.width = `${(v / max) * 100 * pp}%`;
            tx.textContent = fmt(Math.round(v * pp));
          });
        });

        t4(t);
        p4.forEach(({ p, rows, pill }, k) => {
          paneVis(p, t, S[3][0] + 0.1 + k * 0.15, S[3][1]);
          rows.forEach((r, i) => vis(r, t, 19.8 + i * 0.3 + k * 0.15, null, { y: 20, d: 0.5 }));
          vis(pill, t, 21.4 + k * 0.15, null, { y: 16, s: 0.85, d: 0.5, ease: ease.outBack });
        });
      };
    },
  };
})();
