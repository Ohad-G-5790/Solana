// a3 — One band, one tour. Chapter 3: Sell. Live sales -> every city -> confirmations -> Vienna refunded.
(() => {
  const { vis, prog, ease, clamp, lerp, h, fmt } = GR;
  const { S, makePhone, pane, paneVis, add, title, progRow, notifStack, sceneText, tag, eur, TOUR } = PK;

  window.VIDEO = {
    tag: tag("On tour ", 3, "Sell"),
    kicker: "Chapter 3 · Sell",
    punch: "No guessing.\n{g:I see every ticket.}",
    build(stage) {
      const ph = makePhone(stage, { me: "CR" });

      // S1: live sales
      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "On sale", lc: "g", head: "Tickets went on sale\n{g:the same day.}" });
      const p1 = pane(ph);
      title(p1, "Live sales", "All 8 shows");
      const tiles = add(p1, "row", "", { gap: "18px" });
      const mk = (k) => {
        const e = h("div", "prow", `<div class="k">${k}</div><div class="big n" style="font-size:64px">0</div>`, { flex: 1 });
        tiles.appendChild(e);
        return e.querySelector(".n");
      };
      const nT = mk("Tickets");
      const nE = mk("In escrow");
      const feed = add(p1, "", "", { position: "relative", height: 720, overflow: "hidden" });
      const BUYS = [
        [2, "Berlin"], [1, "Prague"], [4, "Leipzig"], [2, "Munich"], [1, "Dresden"], [3, "Berlin"], [2, "Salzburg"], [1, "Prague"], [2, "Brno"], [1, "Leipzig"], [2, "Vienna"], [3, "Prague"],
      ];
      const ROWH = 104;
      const buys = BUYS.map(([q, c], i) => {
        const e = h("div", "prow row between", `<span><b style="color:var(--accent)">+${q}</b>&nbsp; ${c}</span><span style="color:#8a8a8a;font-size:24px">just now</span>`, { position: "absolute", left: 0, right: 0, top: 0, padding: "22px 28px" });
        feed.appendChild(e);
        return { e, at: 1.4 + i * 0.36 };
      });

      // S2: every city
      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], head: "I see {g:every ticket},\nin every city." });
      const p2 = pane(ph);
      title(p2, "November tour", "Threshold: 50% by the deadline");
      const MID = [212, 168, 121, 205, 102, 74];
      const rows2 = TOUR.stops.slice(0, 6).map((s, i) => ({ r: progRow(p2, { name: s.city, cap: s.cap }), to: MID[i] }));

      // S3: confirmed
      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "Berlin hit 50% in 9 days.\n{g:Confirmed.}" });
      const p3 = pane(ph);
      title(p3, "Berlin · Lido", "Nov 3 · deadline Oct 13");
      const big = add(p3, "prow", `<div class="k">Sold</div><div class="big"><span class="n">0</span><span style="color:#8a8a8a;font-size:48px"> / 400</span></div><div class="pbar" style="height:26px;margin-top:22px"><div class="clip"><div class="fill"></div></div><div class="thr" style="left:50%;height:40px;top:-7px"></div></div><div class="row between" style="margin-top:16px;font-size:24px;color:#b3b3b3"><span>need 200</span><span class="st"></span></div>`);
      const bN = big.querySelector(".n");
      const bF = big.querySelector(".fill");
      const bS = big.querySelector(".st");
      const n3 = notifStack(stage, 64, 1180, 952, [
        { at: 15.0, title: "Berlin is confirmed ✓", body: "200 of 400 sold. The show is on." },
        { at: 16.0, title: "Prague is confirmed ✓", body: "200 of 400 sold, 15 days early." },
        { at: 16.9, title: "Leipzig is confirmed ✓", body: "200 of 400 sold." },
      ]);

      // S4: Vienna refunded
      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "Vienna didn't make it.\n{g:Every fan got refunded.}", sub: "I lost nothing. No deposit, no empty room." });
      const p4 = pane(ph);
      title(p4, "Vienna · WUK", "Nov 9 · deadline passed");
      const vr = progRow(p4, { name: "Vienna", sub: "141 of 400 · needed 200", cap: 400 });
      const ref = add(p4, "prow", `<div class="k">Refunded automatically</div><div class="big"><span class="n">0</span><span style="color:#8a8a8a;font-size:48px"> / 141</span></div>`);
      const rN = ref.querySelector(".n");
      const REF = ["7xQm4c…", "Gk2PaB…", "9fTr1z…"];
      const refs = REF.map((w) => add(p4, "prow row between", `<span>Refunded <b>€25</b> to <span class="mono" style="font-size:24px">${w}</span></span><span style="color:var(--accent);font-weight:800">✓</span>`, { padding: "20px 28px" }));

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[2][0] ? "12:20" : t < S[3][0] ? "18:05" : "09:30");

        t1(t);
        paneVis(p1, t, 0.5, S[0][1]);
        let tickets = 0;
        buys.forEach(({ e, at }, i) => {
          let y = 0;
          buys.forEach((o, j) => {
            if (j > i) y += ROWH * prog(t, o.at, 0.35, ease.outCubic);
          });
          e.style.top = `${y}px`;
          vis(e, t, at, null, { y: -30, d: 0.35, ease: ease.outCubic });
          tickets += BUYS[i][0] * prog(t, at, 0.3);
        });
        const base = Math.round(lerp(0, 600, prog(t, 1.0, 4.6, ease.inOutSine)));
        nT.textContent = fmt(base + Math.round(tickets));
        nE.textContent = eur((base + Math.round(tickets)) * TOUR.price);

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        rows2.forEach(({ r, to }, i) => {
          vis(r.el, t, 6.8 + i * 0.15, null, { y: 20, d: 0.5 });
          const sold = to * prog(t, 7.2 + i * 0.1, 3.6, ease.outCubic);
          r.set({ sold, state: sold >= 200 ? "confirmed" : "onSale" });
        });

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        vis(big, t, 13.3, null, { y: 20, d: 0.5 });
        const sold = Math.round(232 * prog(t, 13.6, 1.8, ease.inOutSine));
        bN.textContent = sold;
        bF.style.width = `${(sold / 400) * 100}%`;
        bS.innerHTML = sold >= 200 ? `<span style="color:var(--accent);font-weight:800">Confirmed ✓</span>` : "on sale";
        n3(t, 18.6);

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        vr.set({ sold: 141, state: t < 20.3 ? "onSale" : "cancelled" });
        vis(ref, t, 20.4, null, { y: 20, d: 0.5 });
        rN.textContent = Math.round(141 * prog(t, 20.8, 2.8, ease.inOutSine));
        refs.forEach((e, i) => vis(e, t, 21.2 + i * 0.4, null, { y: 20, d: 0.5 }));
      };
    },
  };
})();
