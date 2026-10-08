// 02 — For venues: dark nights and unverifiable draws -> a venue agent that reads
// on-chain records, signs deals, and gets paid by the split.
(() => {
  const { abs, vis, prog, ease, clamp, lerp, headline, showCard, feedItem, fmt, h } = GR;

  window.VIDEO = {
    num: "02",
    title: "For venues",
    punch: "Fill the calendar.\n{g:Skip the gamble.}",
    build(stage) {
      const L = abs(stage, "layer", "", 0, 0);

      // ---------- S1: the calendar ----------
      const s1Label = abs(L, "label r", "The problem for venues", 120, 262);
      const s1Head = headline(L, "Every {r:dark night}\ncosts you money.", 120, 310, { size: 104, width: 860 });
      const s1Sub = abs(L, "sub", "Rent, staff and the bar don't stop when the stage is empty.", 120, 570, { width: 740 });

      const cal = abs(L, "card", "", 1010, 206, { width: 790, height: 676 });
      cal.innerHTML = `<div class="row between"><span style="font-size:34px;font-weight:700">November 2026</span><span class="pill outline-r num" style="font-size:22px"><span class="n">0</span>&nbsp;dark nights</span></div>`;
      const dn = cal.querySelector(".n");
      const grid = h("div", "", "", { position: "relative", marginTop: 26, height: 560 });
      cal.appendChild(grid);
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d, i) =>
        grid.appendChild(h("div", "", d, { position: "absolute", left: i * 104, top: 0, width: 94, textAlign: "center", fontSize: 18, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#8a8a8a" })),
      );
      const BOOKED = new Set([6, 7, 12, 13, 14, 20, 21, 26, 27, 28]);
      const cells = [];
      for (let day = 1; day <= 30; day++) {
        const idx = day + 5; // Nov 1 2026 is a Sunday -> column 6 of a Monday-first grid
        const col = idx % 7;
        const row = Math.floor(idx / 7);
        const booked = BOOKED.has(day);
        const c = h("div", "", `<div style="font-size:20px;font-weight:700">${day}</div><div class="tag" style="font-size:15px;margin-top:6px;font-weight:600">${booked ? "Show" : ""}</div>`, {
          position: "absolute", left: col * 104, top: 40 + row * 84, width: 94, height: 74, borderRadius: 10, padding: "10px 12px",
          background: booked ? "#2a2a2a" : "#1c1c1c", color: booked ? "#fff" : "#7c7c7c",
        });
        grid.appendChild(c);
        cells.push({ c, day, booked, k: day });
      }
      const dark = cells.filter((x) => !x.booked);

      // ---------- S2: the gamble ----------
      const s2Head = headline(L, "And every booking\nis a {r:gamble.}", 120, 300, { size: 92, width: 880 });
      const s2Sub = abs(L, "sub", "Clubs of 150 to 1,500 run on thin margins. One bad night can sink a month.", 120, 560, { width: 740 });
      const PROBS = [
        ["“We draw 400.”", "You can't check it until the night itself."],
        ["Deposits and guarantees", "Someone has to front the risk. Usually you."],
        ["Promoters in the middle", "They carry the risk, so they price it in."],
      ];
      const probs = PROBS.map(([t, s], i) =>
        abs(L, "card", `<div class="row" style="gap:26px;align-items:flex-start"><div style="flex:none;width:56px;height:56px;border-radius:50%;box-shadow:inset 0 0 0 3px var(--negative);color:var(--negative);font-weight:800;font-size:28px;display:flex;align-items:center;justify-content:center">!</div><div><div style="font-size:36px;font-weight:700">${t}</div><div style="font-size:26px;color:#b3b3b3;margin-top:8px">${s}</div></div></div>`, 1010, 236 + i * 210, { width: 790, padding: "34px 36px" }),
      );

      // ---------- S3: the venue agent ----------
      const s3Label = abs(L, "label g", "With Greenroom", 120, 196);
      const s3Head = headline(L, "Your venue gets\nan {g:AI agent.}", 120, 240, { size: 92, width: 780 });
      const venue = abs(L, "card", `
        <div class="row between"><div><div style="font-size:36px;font-weight:700">Lido</div><div style="font-size:22px;color:#b3b3b3;margin-top:4px">Berlin · Kreuzberg</div></div><span class="pill">cap 600</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:24px">
          <span class="pill" style="font-size:20px">indie · rock · electronic</span>
          <span class="pill" style="font-size:20px">15 free days in Nov</span>
          <span class="pill" style="font-size:20px">base share 30%</span>
        </div>`, 120, 470, { width: 780 });
      const s3Sub = abs(L, "sub", "It knows your calendar and your terms, reads every band's on-chain record, then <b>makes the offer and signs the deal.</b>", 120, 742, { width: 790, fontSize: 31 });

      const FX = 960;
      const FW = 840;
      const req = feedItem(L, FX, 196, FW, {
        who: "Band agent",
        kind: "tour.request",
        text: "Cinema of Royal Street (rock) wants 8 shows across DE/AT/CZ in November. We draw about 400 people; on-chain record: <b style='color:#fff'>12 settled shows, 4,380 tickets.</b>",
      });
      const verified = abs(L, "row", `<span class="pill outline-g" style="font-size:21px">✓ Record read from Solana</span><span class="pill" style="font-size:21px">12 shows settled</span><span class="pill" style="font-size:21px">avg 365 / show</span>`, FX, 390, { gap: "12px" });
      const offer = feedItem(L, FX, 474, FW, {
        who: "Lido's agent",
        kind: "venue.offer",
        text: "Lido: rock fits our programme, draw 400 vs capacity 600, strong track record. Offer: up to 400 tickets, <b style='color:#fff'>27% to the venue</b>, 15 free days.",
      });
      const accept = feedItem(L, FX, 664, FW, {
        who: "Lido's agent",
        kind: "show.accepted",
        tx: true,
        text: "<b style='color:#fff'>accept_show</b> signed on-chain · Berlin, Nov 3 · now on sale<div class='mono' style='font-size:19px;color:#8a8a8a;margin-top:6px'>tx 4vJ9pXe…kQ2mT8</div>",
      });

      // ---------- S4: only shows that sell; paid by the split ----------
      const s4Head = headline(L, "Only shows that {g:sell} go ahead.", 120, 196, { size: 80, width: 1700 });
      const s4Sub = abs(L, "sub", "You know it sold before the night, not on it. After the show, your share pays out on its own.", 120, 300, { width: 1700 });
      const card = showCard(L, 120, 420, 560, { city: "Berlin", venue: "Lido", day: 0, date: "Nov 3", capacity: 400 });
      const settle = abs(L, "card", "", 740, 420, { width: 1060, height: 330 });
      settle.innerHTML = `
        <div class="row between"><div style="font-size:30px;font-weight:700"><span class="mono" style="font-size:26px;color:var(--accent)">settle_show</span> · Berlin, Nov 3</div><span class="pill num tot" style="font-size:22px;color:#fff">31.8 SOL</span></div>
        <div class="bar" style="position:relative;height:64px;margin-top:40px;border-radius:12px;overflow:hidden;background:#1f1f1f">
          <div class="band" style="position:absolute;left:0;top:0;bottom:0;background:var(--accent)"></div>
          <div class="ven" style="position:absolute;top:0;bottom:0;background:#e6e6e6"></div>
        </div>
        <div class="row between" style="margin-top:22px;align-items:flex-start">
          <div class="lb"><div style="font-size:22px;color:#b3b3b3">Band · 73%</div><div class="num" style="font-size:34px;font-weight:800;margin-top:4px">23.2 SOL</div></div>
          <div class="lv" style="text-align:right"><div style="font-size:22px;color:#b3b3b3">Lido · 27%</div><div class="num" style="font-size:34px;font-weight:800;margin-top:4px;color:#fff">8.6 SOL</div></div>
        </div>`;
      const sBand = settle.querySelector(".band");
      const sVen = settle.querySelector(".ven");
      const sLb = settle.querySelector(".lb");
      const sLv = settle.querySelector(".lv");
      const paid = abs(L, "pill g", "✓ Paid out in one transaction", 740, 784, { fontSize: 24 });
      const chipRow = abs(L, "row", "", 120, 880, { gap: "18px" });
      const chips = ["No deposits to chase", "No promoter in the middle", "A draw you can verify"].map((t) => {
        const e = h("span", "pill outline-g", `✓ ${t}`, { fontSize: 24 });
        chipRow.appendChild(e);
        return e;
      });

      return (t) => {
        // S1
        vis(s1Label, t, 0.25, 5.7, { y: 20 });
        s1Head.update(t, 0.4, 5.7);
        vis(s1Sub, t, 1.4, 5.7);
        vis(cal, t, 0.5, 5.75, { y: 60, s: 0.97, d: 0.9 });
        cells.forEach(({ c, k }) => vis(c, t, 0.7 + k * 0.025, null, { y: 16, d: 0.5 }));
        let n = 0;
        dark.forEach((x, i) => {
          const at = 2.0 + i * 0.1;
          const p = prog(t, at, 0.35);
          if (t >= at) n++;
          x.c.style.boxShadow = `inset 0 0 0 ${(2 * p).toFixed(2)}px rgba(243,114,127,${(0.85 * p).toFixed(3)})`;
          x.c.style.background = `rgba(243,114,127,${(0.06 * p).toFixed(3)})`;
        });
        dn.textContent = n;

        // S2
        s2Head.update(t, 6.05, 11.3);
        vis(s2Sub, t, 7.0, 11.3);
        probs.forEach((p, i) => vis(p, t, 6.5 + i * 0.45, 11.35, { x: 60, y: 0, d: 0.8 }));

        // S3
        vis(s3Label, t, 11.6, 19.3, { y: 20 });
        s3Head.update(t, 11.7, 19.3);
        vis(venue, t, 12.3, 19.3, { y: 50 });
        vis(s3Sub, t, 17.6, 19.3);
        vis(req, t, 12.9, 19.35, { x: 60, y: 0 });
        vis(verified, t, 14.1, 19.35, { y: 20, s: 0.9, ease: ease.outBack, d: 0.55 });
        vis(offer, t, 15.2, 19.35, { x: 60, y: 0 });
        vis(accept, t, 16.5, 19.35, { x: 60, y: 0 });

        // S4
        s4Head.update(t, 19.5, 25.15);
        vis(s4Sub, t, 20.0, 25.15);
        vis(card.el, t, 20.2, 25.2, { y: 70, d: 0.9 });
        const sold = Math.round(318 * prog(t, 20.5, 1.7, ease.outCubic));
        const st = t < 23.0 ? (sold >= 200 ? "confirmed" : "onSale") : "settled";
        card.set({ sold, state: st, m1: st === "onSale" ? "deadline in 9 days" : st === "confirmed" ? "settles after the show" : "settled", m2: st === "settled" ? "paid out" : `${fmt(sold * 0.1, 1)} SOL in escrow` });
        vis(settle, t, 20.5, 25.2, { y: 70, d: 0.9 });
        const sp = prog(t, 22.4, 1.0, ease.inOutCubic);
        sBand.style.width = `${73 * sp}%`;
        sVen.style.left = `${73 + 27 * (1 - sp)}%`;
        sVen.style.width = `${27 * sp}%`;
        sLb.style.opacity = clamp((t - 22.9) / 0.4);
        sLv.style.opacity = clamp((t - 23.1) / 0.4);
        vis(paid, t, 23.5, 25.2, { y: 20, s: 0.85, ease: ease.outBack, d: 0.55 });
        chips.forEach((c, i) => vis(c, t, 23.9 + i * 0.2, 25.2, { y: 24, s: 0.85, ease: ease.outBack, d: 0.55 }));
      };
    },
  };
})();
