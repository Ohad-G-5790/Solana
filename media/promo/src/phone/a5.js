// a5 — One band, one tour. Chapter 5: Payday. Paid -> where every euro went -> the tour -> a better record.
(() => {
  const { vis, prog, ease, clamp, lerp, h, fmt } = GR;
  const { S, makePhone, pane, paneVis, add, title, splitBar, barList, notifStack, sceneText, eur, TOUR } = PK;

  // Band take per city: 70% of sales, Leipzig 66% (4% to the sound engineer), Vienna refunded.
  const TAKE = TOUR.stops.map((s) => ({ ...s, take: s.cancelled ? 0 : s.sold * TOUR.price * (s.city === "Leipzig" ? 0.66 : 0.7) }));
  const TOTAL = TAKE.reduce((n, s) => n + s.take, 0);
  const SOLD = TOUR.stops.filter((s) => !s.cancelled).reduce((n, s) => n + s.sold, 0);

  window.VIDEO = {
    kicker: "Chapter 5 · Payday",
    punch: "Payday is\n{g:the morning after.}",
    build(stage) {
      const ph = makePhone(stage, { me: "CR" });

      // S1: paid
      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Nov 5, 08:03", lc: "g", head: "The morning\nafter Leipzig." });
      const p1 = pane(ph);
      title(p1, "Wallet", "Cinema of Royal Street");
      const bal = add(p1, "prow", `<div class="k">Received</div><div class="big" style="font-size:96px;color:var(--accent)">+<span class="n">€0</span></div><div style="font-size:24px;color:#b3b3b3;margin-top:8px">Leipzig · Conne Island · settled on Solana</div>`);
      const balN = bal.querySelector(".n");
      const n1 = notifStack(stage, 64, 1240, 952, [{ at: 1.6, title: "You were paid €5,247", body: "Leipzig, Nov 4 · 318 tickets · settled on Solana" }]);

      // S2: where every euro went
      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], head: "I know exactly\n{g:where every euro went.}" });
      const p2 = pane(ph);
      title(p2, "Leipzig · Nov 4", "318 tickets × €25 = €7,950");
      const card = add(p2, "prow");
      const sb = splitBar(card, [
        { label: "Band · 66%", pct: 66, color: "var(--accent)", amount: "€5,247" },
        { label: "Conne Island · 30%", pct: 30, color: "#e6e6e6", amount: "€2,385" },
        { label: "Katrin W. · sound · 4%", pct: 4, color: "var(--info)", amount: "€318" },
      ], { hgt: 56, mt: 0 });
      const chips = add(p2, "row", ["No booker", "No promoter", "No fees on top"].map((c) => `<span class="pill outline-g" style="font-size:22px">✓ ${c}</span>`).join(""), { gap: "12px", flexWrap: "wrap", marginTop: 8 });

      // S3: the tour
      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "The whole tour,\n{g:city by city.}" });
      const p3 = pane(ph);
      const head3 = add(p3, "prow", `<div class="k">To the band · ${SOLD.toLocaleString("en-US")} tickets</div><div class="big n">€0</div>`);
      const tot = head3.querySelector(".n");
      const bars = barList(p3, TAKE.map((s) => ({ label: `${s.city} <span style="color:#8a8a8a">· ${s.date}</span>`, value: s.take, text: s.cancelled ? () => "refunded" : undefined, color: s.cancelled ? "var(--negative)" : "#fff" })), 7000, { gap: 12 });

      // S4: the record grew
      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "And my record grew.\n{g:Next tour, venues ask less.}" });
      const p4 = pane(ph);
      title(p4, "Band record", "On-chain · anyone can check it");
      const stats = add(p4, "row", "", { gap: "18px" });
      const tile = (k) => {
        const e = h("div", "prow", `<div class="k">${k}</div><div class="big n" style="font-size:64px">0</div>`, { flex: 1 });
        stats.appendChild(e);
        return e.querySelector(".n");
      };
      const sN = tile("Shows settled");
      const tN = tile("Tickets sold");
      const ask = add(p4, "prow", `<div class="k">What venues ask</div><div class="row between" style="margin-top:12px"><span style="font-size:30px">Before this tour</span><b style="font-size:40px">30%</b></div><div class="row between" style="margin-top:10px"><span style="font-size:30px">After this tour</span><b style="font-size:40px;color:var(--accent)">27%</b></div>`);
      const plus = add(p4, "pill g", "+3 points to us on every show", { fontSize: 26, alignSelf: "flex-start", marginTop: 6 });

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[2][0] ? "08:03" : "08:20");

        t1(t);
        paneVis(p1, t, 0.5, S[0][1]);
        vis(bal, t, 1.0, null, { y: 20, d: 0.5 });
        balN.textContent = eur(5247 * prog(t, 2.2, 1.6, ease.outCubic));
        n1(t, 5.6);

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        vis(card, t, 6.9, null, { y: 20, d: 0.5 });
        sb.set(prog(t, 7.2, 1.0, ease.inOutCubic), t, 7.8);
        vis(chips, t, 9.6, null, { y: 20, d: 0.5 });

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        vis(head3, t, 13.2, null, { y: 20, d: 0.5 });
        tot.textContent = eur(TOTAL * prog(t, 13.6, 3.0, ease.inOutSine));
        bars.set(t, 13.6, 0.18);

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        const np = prog(t, 19.8, 1.6, ease.outCubic);
        sN.textContent = Math.round(lerp(2, 9, np));
        tN.textContent = fmt(Math.round(lerp(610, 610 + SOLD, np)));
        vis(ask, t, 20.8, null, { y: 20, d: 0.5 });
        vis(plus, t, 22.0, null, { y: 16, s: 0.85, d: 0.5, ease: ease.outBack });
      };
    },
  };
})();
