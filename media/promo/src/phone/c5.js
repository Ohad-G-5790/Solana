// c5 — Small vs big. Record: everyone starts somewhere -> the record sets the terms -> every show counts -> small acts catch up.
(() => {
  const { vis, prog, ease, clamp, lerp, h, fmt } = GR;
  const { S, pane, paneVis, add, bigTitle: title, duo, duoText, bigCard, bigRow, splitBar, tag, LENA, RUSTY } = PK;

  // Venue-agent pricing in the app: 35% with no record, 27% with a strong one (3+ settled shows averaging half the draw).
  window.VIDEO = {
    tag: tag("Small or big ", 5, "Track record"),
    kicker: "Small or big · Track record",
    punch: "Every show\n{g:builds my leverage.}",
    build(stage) {
      const d = duo(stage, LENA, RUSTY);
      const both = (fn) => [fn(d.L, LENA, 0), fn(d.R, RUSTY, 1)];
      const sc = (i, L, R, foot) => duoText(stage, { a: S[i][0], b: S[i][1], L, R, foot });
      const stat2 = (p, k1, k2) => {
        const a = bigCard(p, k1, "0");
        const b = bigCard(p, k2, "0", { size: 90 });
        return [a, b];
      };

      const t1 = sc(0, "First tour:\n{r:0 shows}\non record.", "We have\n{g:40.}", "Everyone starts\n{g:somewhere.}");
      const p1 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Record");
        return { p, cards: stat2(p, "Shows settled", "Tickets sold"), to: a === LENA ? [0, 0] : [40, 112400] };
      });

      const t2 = sc(1, "Venues asked\nme {r:35%.}", "They ask\nus {g:27%.}", "Your record\n{g:sets your terms.}");
      const p2 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Venue share");
        const L = a === LENA;
        return { p, c: bigCard(p, L ? "No record yet" : "Strong record", L ? "35%" : "27%", { size: 150, color: L ? "var(--negative)" : "var(--accent)" }) };
      });

      const t3 = sc(2, "Five shows\n{g:later…}", "…six more\n{g:for us.}", "Every settled show\n{g:counts.}");
      const p3 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Record");
        const L = a === LENA;
        return { p, cards: stat2(p, "Shows settled", "Tickets sold"), from: L ? [0, 0] : [40, 112400], to: L ? [5, 684] : [46, 127900] };
      });

      const t4 = sc(3, "Now they ask\nme {g:27%.}", "Same as\n{g:us.}", "Small acts\n{g:catch up fast.}");
      const p4 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Next tour");
        const L = a === LENA;
        const c = bigCard(p, "Venue share", L ? "35%" : "27%", { size: 150, color: L ? "var(--negative)" : "var(--accent)" });
        const card = add(p, "prow", `<div class="k" style="font-size:30px">${L ? "To me" : "To us"}</div><div class="bandpct" style="font-family:var(--display);font-size:96px;font-weight:800;margin-top:6px">${L ? "65%" : "73%"}</div><div style="height:30px;border-radius:9999px;background:#262626;margin-top:16px;overflow:hidden"><div class="f" style="height:100%;border-radius:9999px;background:var(--accent);width:${L ? 65 : 73}%"></div></div>`, { padding: "30px 34px" });
        return { p, c, card, L };
      });

      return (t) => {
        d.show(t);
        [d.L, d.R].forEach((ph) => ph.setTime(t < S[2][0] ? "10:00" : "10:30"));

        t1(t);
        p1.forEach(({ p, cards, to }, k) => {
          paneVis(p, t, 0.6 + k * 0.15, S[0][1]);
          cards.forEach((c, i) => {
            vis(c, t, 1.3 + i * 0.5 + k * 0.15, null, { y: 20, d: 0.5 });
            c.querySelector(".n").textContent = fmt(Math.round(to[i] * prog(t, 1.6 + k * 0.15, 2.4, ease.outCubic)));
          });
        });

        t2(t);
        p2.forEach(({ p, c }, k) => {
          paneVis(p, t, S[1][0] + 0.1 + k * 0.15, S[1][1]);
          vis(c, t, 7.1 + k * 0.3, null, { y: 30, s: 0.9, d: 0.6, ease: ease.outBack });
        });

        t3(t);
        p3.forEach(({ p, cards, from, to }, k) => {
          paneVis(p, t, S[2][0] + 0.1 + k * 0.15, S[2][1]);
          cards.forEach((c, i) => {
            vis(c, t, 13.3 + i * 0.4 + k * 0.15, null, { y: 20, d: 0.5 });
            c.querySelector(".n").textContent = fmt(Math.round(lerp(from[i], to[i], prog(t, 13.8 + k * 0.3, 2.8, ease.inOutSine))));
          });
        });

        t4(t);
        p4.forEach(({ p, c, card, L }, k) => {
          paneVis(p, t, S[3][0] + 0.1 + k * 0.15, S[3][1]);
          vis(c, t, 19.8 + k * 0.15, null, { y: 20, d: 0.5 });
          vis(card, t, 20.3 + k * 0.15, null, { y: 20, d: 0.5 });
          if (L) {
            const q = prog(t, 21.0, 1.6, ease.inOutCubic);
            const n = c.querySelector(".n");
            n.textContent = `${Math.round(lerp(35, 27, q))}%`;
            n.style.color = q > 0.5 ? "var(--accent)" : "var(--negative)";
            card.querySelector(".bandpct").textContent = `${Math.round(lerp(65, 73, q))}%`;
            card.querySelector(".f").style.width = `${lerp(65, 73, q)}%`;
          }
        });
      };
    },
  };
})();
