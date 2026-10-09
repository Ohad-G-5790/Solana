// b5 — Five musicians. Jonas, session drummer: chasing invoices -> pitches only for sold shows -> on the deal -> paid with the band.
(() => {
  const { vis, prog, ease, clamp, h, fmt } = GR;
  const { S, makePhone, pane, paneVis, add, title, splitBar, notifStack, sceneText, tag, eur } = PK;

  // Dresden, Nov 5 (Cinema of Royal Street at Beatpol): 264 tickets x EUR 25 = EUR 6,600; a 6% payee gets EUR 396.
  window.VIDEO = {
    tag: tag("Musicians ", 5, "Session player"),
    kicker: "Jonas · session drummer",
    punch: "No invoices.\n{g:No chasing.}",
    build(stage) {
      const ph = makePhone(stage, { me: "J" });

      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Session drummer", lc: "r", head: "I'm Jonas. I drum for hire.\n{r:I used to chase invoices.}" });
      const p1 = pane(ph);
      title(p1, "Invoices", "Gigs I've already played");
      const INV = [
        ["Hamburg · Oct 2", "€350", "61 days overdue"],
        ["Cologne · Oct 9", "€300", "34 days overdue"],
        ["Berlin · Oct 21", "€400", "“next week, promise”"],
        ["Bremen · Oct 25", "€250", "no reply"],
      ];
      const inv = INV.map(([g, a, s]) => add(p1, "prow row between", `<div><b style="font-size:28px">${g}</b><div style="font-size:23px;color:var(--negative);margin-top:2px">${s}</div></div><b style="font-size:32px">${a}</b>`));

      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], label: "With Greenroom", lc: "g", head: "Now I only pitch for shows\n{g:that already sold.}" });
      const p2 = pane(ph);
      title(p2, "Confirmed near me", "Bands looking for a session drummer");
      const GIGS = [
        ["Dresden · Nov 5", "Cinema of Royal Street · Beatpol", "264 sold · confirmed"],
        ["Leipzig · Nov 14", "The Broken Tides · Werk 2", "604 sold · confirmed"],
        ["Berlin · Nov 21", "Crimson Gardens · SO36", "250 sold · confirmed"],
      ];
      const gigs = GIGS.map(([a, b, c]) => {
        const e = add(p2, "prow", `<div class="row between"><b style="font-size:29px">${a}</b><span class="pp pill outline-g" style="font-size:20px;padding:6px 18px">Pitch 6%</span></div><div style="font-size:23px;color:#b3b3b3;margin-top:4px">${b}</div><div style="font-size:22px;color:var(--accent);margin-top:4px">${c}</div>`);
        return { e, pp: e.querySelector(".pp") };
      });
      const n2 = notifStack(stage, 64, 1300, 952, [{ at: 10.4, title: "Pitch sent · Dresden, Nov 5", body: "Session drummer · 6% of the show · 4.9★ · 12 years" }]);

      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "The band added me\n{g:to the deal. On-chain.}" });
      const p3 = pane(ph);
      title(p3, "You're on the deal", "Dresden · Nov 5 · Beatpol");
      const card = add(p3, "prow");
      const sb = splitBar(card, [
        { label: "Cinema of Royal Street · 64%", pct: 64, color: "var(--accent)", amount: "64%" },
        { label: "Beatpol · 30%", pct: 30, color: "#e6e6e6", amount: "30%" },
        { label: "Me · session drums · 6%", pct: 6, color: "var(--info)", amount: "6%" },
      ], { hgt: 56, mt: 0 });
      const esc = add(p3, "prow", `<div class="row between"><span style="color:#b3b3b3">In escrow now</span><b style="font-size:34px">€6,600</b></div><div class="row between" style="margin-top:10px"><span style="color:#b3b3b3">My share</span><b style="font-size:34px;color:var(--info)">€396</b></div>`);

      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "Show's over.\n{g:Paid with the band.}", sub: "Same transaction. Same minute." });
      const p4 = pane(ph);
      title(p4, "Wallet", "Jonas · session drums");
      const bal = add(p4, "prow", `<div class="k">Received</div><div class="big" style="font-size:96px;color:var(--accent)">+<span class="n">€0</span></div><div style="font-size:24px;color:#b3b3b3;margin-top:8px">Dresden · Beatpol · settled on Solana</div>`);
      const balN = bal.querySelector(".n");
      const n4 = notifStack(stage, 64, 1300, 952, [{ at: 20.2, title: "You were paid €396", body: "Dresden, Nov 5 · paid in the same settlement as the band" }]);

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[1][0] ? "23:02" : t < S[3][0] ? "11:20" : "00:31");

        t1(t);
        paneVis(p1, t, 0.5, S[0][1]);
        inv.forEach((e, i) => vis(e, t, 1.1 + i * 0.45, null, { y: 20, d: 0.5 }));

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        gigs.forEach(({ e }, i) => vis(e, t, 7.0 + i * 0.4, null, { x: 40, y: 0, d: 0.5 }));
        const sent = t > 9.9;
        gigs[0].pp.className = `pp pill ${sent ? "g" : "outline-g"}`;
        gigs[0].pp.textContent = sent ? "Pitched ✓" : "Pitch 6%";
        gigs[0].e.style.boxShadow = `inset 0 0 0 ${(3 * prog(t, 9.9, 0.4)).toFixed(2)}px var(--accent)`;
        n2(t, 12.2);

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        vis(card, t, 13.3, null, { y: 20, d: 0.5 });
        sb.set(prog(t, 13.6, 1.0, ease.inOutCubic), t, 14.2);
        vis(esc, t, 15.6, null, { y: 20, d: 0.5 });

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        vis(bal, t, 19.8, null, { y: 20, d: 0.5 });
        balN.textContent = eur(396 * prog(t, 20.6, 1.4, ease.outCubic));
        n4(t, 24.8);
      };
    },
  };
})();
