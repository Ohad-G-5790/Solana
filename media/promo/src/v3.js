// 03 — Cheaper concerts: the fee stack and the middle layers -> agents, escrow,
// Solana fees in cents, automatic refunds.
(() => {
  const { abs, vis, prog, ease, clamp, lerp, headline, showCard, feedItem, fmt, h } = GR;

  const ICONS = {
    chat: `<path d="M10 14h26a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H22l-8 6v-6h-4a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"/><path d="M30 34v2a4 4 0 0 0 4 4h8l6 5v-5h2a4 4 0 0 0 4-4V26a4 4 0 0 0-4-4h-6"/>`,
    lock: `<rect x="14" y="26" width="32" height="24" rx="5"/><path d="M20 26v-6a10 10 0 0 1 20 0v6"/><path d="M30 35v6"/>`,
    coin: `<circle cx="30" cy="30" r="18"/><path d="M36 23.5a8 8 0 1 0 0 13"/><path d="M20 28h11M20 32.5h11"/>`,
    route: `<circle cx="16" cy="44" r="5"/><circle cx="44" cy="16" r="5"/><path d="M21 44h13a7 7 0 0 0 0-14H26a7 7 0 0 1 0-14h13" stroke-dasharray="5 5"/>`,
  };
  const icon = (k) => `<div style="width:84px;height:84px;border-radius:50%;box-shadow:inset 0 0 0 3px var(--accent);display:flex;align-items:center;justify-content:center"><svg width="56" height="56" viewBox="0 0 60 60" fill="none" stroke="#1ed760" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg></div>`;

  window.VIDEO = {
    punch: "Pay for the show.\n{g:Not the middlemen.}",
    build(stage) {
      const L = abs(stage, "layer", "", 0, 0);

      // ---------- S1: the checkout ----------
      const s1Label = abs(L, "label r", "The problem for fans", 120, 250);
      const s1Head = headline(L, "The price you see\nis {r:not} the price\nyou pay.", 120, 298, { size: 100, width: 880 });
      const rc = abs(L, "card", "", 1030, 214, { width: 770, height: 592, padding: "36px 40px" });
      rc.innerHTML = `<div class="row between"><span style="font-size:34px;font-weight:700">Checkout</span><span class="pill" style="font-size:20px">Example</span></div>`;
      const LINES = [
        ["General admission × 1", 40.0, 0.9, false],
        ["Service fee", 7.2, 1.9, true],
        ["Facility charge", 2.0, 2.4, true],
        ["Order processing", 1.6, 2.9, true],
      ];
      const lines = LINES.map(([k, v, at, fee], i) => {
        const r = h("div", "abs row between", `<span>${k}</span><span class="num" style="font-weight:700;color:${fee ? "var(--negative)" : "#fff"}">${fee ? "+ " : ""}€${v.toFixed(2)}</span>`, { left: 40, top: 128 + i * 74, width: 690, fontSize: 29, color: fee ? "#cbcbcb" : "#fff" });
        rc.appendChild(r);
        return { r, v, at };
      });
      const divider = h("div", "abs", "", { left: 40, top: 432, width: 690, height: 2, background: "#3a3a3a" });
      rc.appendChild(divider);
      const total = h("div", "abs row between", `<span style="font-size:30px;font-weight:700">You pay</span><span class="row" style="gap:18px"><span class="pill outline-r pct" style="font-size:24px">+27%</span><span class="num tv" style="font-family:var(--display);font-size:64px;font-weight:800;letter-spacing:-0.02em">€40.00</span></span>`, { left: 40, top: 470, width: 690 });
      rc.appendChild(total);
      const tv = total.querySelector(".tv");
      const pct = total.querySelector(".pct");
      const s1Foot = abs(L, "foot", "Fees on primary-market tickets averaged 27% of the ticket price in the events reviewed by the U.S. Government Accountability Office (GAO-18-347, 2018). Checkout shown is an example.", 120, 900, { width: 1680 });

      // ---------- S2: the layers ----------
      const s2Head = headline(L, "Every layer\nin the middle adds\nto the price.", 120, 236, { size: 84, width: 820 });
      const s2Sub = abs(L, "sub", "Same money for the band and the venue. <b>Less for the fan to pay.</b>", 120, 560, { width: 740 });
      const s2Foot = abs(L, "foot", "Illustration, not to scale.", 120, 880);
      const BASE = 860;
      const LAYERS = [
        ["Band", 190, "#1ed760", "#000"],
        ["Venue", 120, "#cbcbcb", "#000"],
        ["Booker's cut", 58, "rgba(243,114,127,0.30)", "#fff"],
        ["Promoter margin", 72, "rgba(243,114,127,0.45)", "#fff"],
        ["Risk premium", 58, "rgba(243,114,127,0.62)", "#fff"],
        ["Ticketing fees", 100, "rgba(243,114,127,0.85)", "#000"],
      ];
      const mkBar = (x, layers) =>
        layers.map(([name, hgt, bg, fg]) => {
          const e = abs(L, "", `<span>${name}</span>`, x, 0, { width: 300, height: hgt, background: bg, color: fg, fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", paddingLeft: 20, overflow: "hidden", borderTop: "2px solid #121212", whiteSpace: "nowrap" });
          return { e, hgt };
        });
      const today = mkBar(960, LAYERS);
      const gr = mkBar(1340, [LAYERS[0], LAYERS[1], ["Greenroom fee ≤1%", 34, "#2a2a2a", "#cbcbcb"]]);
      const tTitle = abs(L, "label", "Today", 960, BASE + 24, { width: 300, textAlign: "center" });
      const gTitle = abs(L, "label g", "With Greenroom", 1340, BASE + 24, { width: 300, textAlign: "center" });
      const todayTop = BASE - LAYERS.reduce((n, l) => n + l[1], 0);
      const grTop = BASE - (190 + 120 + 34);
      const dash = abs(L, "", "", 960, todayTop - 1, { width: 700, height: 0, borderTop: "3px dashed #4d4d4d" });
      const arrow = abs(L, "", `<svg width="40" height="${grTop - todayTop}" viewBox="0 0 40 ${grTop - todayTop}"><path d="M20 4 V${grTop - todayTop - 6} M8 ${grTop - todayTop - 18} L20 ${grTop - todayTop - 4} L32 ${grTop - todayTop - 18}" stroke="#1ed760" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`, 1470, todayTop, {});
      const arrowLbl = abs(L, "pill g", "Cheaper ticket", 1522, todayTop + (grTop - todayTop) / 2 - 24, { fontSize: 22, transformOrigin: "left center" });

      // ---------- S3: how ----------
      const s3Head = headline(L, "How Greenroom {g:cuts the cost}", 120, 196, { size: 80, width: 1700 });
      const HOW = [
        ["chat", "Agents, not bookers", "Band and venue agents negotiate directly. No commission for passing messages."],
        ["lock", "Escrow, not deposits", "A show goes ahead only once it sells, so nobody prices in an empty room."],
        ["coin", "Cents, not 27%", "Each ticket settles on Solana for cents. Greenroom's fee: 1% or less."],
        ["route", "Shorter drives", "Routes planned for distance, crew hired locally. Lower costs, lower prices."],
      ];
      const how = HOW.map(([ic, t, b], i) => abs(L, "card", `${icon(ic)}<div style="font-size:36px;font-weight:700;margin-top:34px;line-height:1.15">${t}</div><div style="font-size:26px;color:#b3b3b3;margin-top:16px;line-height:1.38">${b}</div>`, 120 + i * 423, 340, { width: 390, height: 470, padding: "40px 36px" }));

      // ---------- S4: refunds ----------
      const s4Head = headline(L, "Show didn't sell?\n{g:Everyone gets\nrefunded.}", 120, 220, { size: 88, width: 860 });
      const s4Sub = abs(L, "sub", "Automatically, by the program. No vouchers, no support tickets, no waiting.", 120, 560, { width: 760 });
      const vcard = showCard(L, 1000, 190, 800, { city: "Vienna", venue: "WUK", day: 6, date: "Nov 9", capacity: 400 });
      const FEED = [
        { who: "Crank", kind: "crank.cancelled", text: "Deadline passed with 141/400 sold (needed 200): show cancelled, refunds start." },
        { who: "Crank", kind: "crank.refunded", tx: true, text: "Refunded 0.1 SOL to <span class='mono' style='font-size:21px'>7xQm4c…</span>" },
        { who: "Crank", kind: "crank.refunded", tx: true, text: "Refunded 0.2 SOL to <span class='mono' style='font-size:21px'>Gk2PaB…</span>" },
        { who: "Crank", kind: "crank.refunded", tx: true, text: "Refunded 0.1 SOL to <span class='mono' style='font-size:21px'>9fTr1z…</span>" },
      ];
      const feed = FEED.map((d, i) => feedItem(L, 1000, 474 + i * 108, 800, d));

      return (t) => {
        // S1
        vis(s1Label, t, 0.25, 6.7, { y: 20 });
        s1Head.update(t, 0.4, 6.7);
        vis(rc, t, 0.5, 6.75, { y: 60, s: 0.97, d: 0.9 });
        let sum = 0;
        lines.forEach(({ r, v, at }) => {
          vis(r, t, at, null, { y: 20, d: 0.5 });
          sum += v * prog(t, at + 0.1, 0.5, ease.outCubic);
        });
        vis(divider, t, 3.3, null, { y: 0, d: 0.4 });
        vis(total, t, 1.0, null, { y: 20 });
        tv.textContent = `€${sum.toFixed(2)}`;
        tv.style.color = sum > 40.05 ? "var(--negative)" : "#fff";
        vis(pct, t, 3.6, null, { y: 0, s: 0.4, d: 0.6, ease: ease.outBack });
        vis(s1Foot, t, 3.9, 6.7, { y: 10 });

        // S2
        s2Head.update(t, 7.0, 13.5);
        vis(s2Sub, t, 10.9, 13.5);
        vis(s2Foot, t, 8.0, 13.5, { y: 10 });
        let y = BASE;
        today.forEach(({ e, hgt }, i) => {
          const p = prog(t, 7.4 + i * 0.32, 0.55, ease.outCubic);
          const hh = hgt * p;
          y -= hh;
          e.style.top = `${y}px`;
          e.style.height = `${hh}px`;
          vis(e, t, 7.4 + i * 0.32, 13.55, { y: 0, d: 0.3 });
        });
        y = BASE;
        gr.forEach(({ e, hgt }, i) => {
          const p = prog(t, 9.9 + i * 0.3, 0.55, ease.outCubic);
          const hh = hgt * p;
          y -= hh;
          e.style.top = `${y}px`;
          e.style.height = `${hh}px`;
          vis(e, t, 9.9 + i * 0.3, 13.55, { y: 0, d: 0.3 });
        });
        vis(tTitle, t, 7.3, 13.5, { y: 10 });
        vis(gTitle, t, 9.8, 13.5, { y: 10 });
        vis(dash, t, 10.9, 13.5, { y: 0, x: -40, d: 0.6 });
        const ap = prog(t, 11.2, 0.6, ease.outCubic);
        arrow.style.clipPath = `inset(0 0 ${(100 * (1 - ap)).toFixed(1)}% 0)`;
        vis(arrow, t, 11.2, 13.5, { y: 0, d: 0.2 });
        vis(arrowLbl, t, 11.6, 13.5, { y: 0, x: -20, s: 0.85, d: 0.5, ease: ease.outBack });

        // S3
        s3Head.update(t, 13.85, 20.7);
        how.forEach((c, i) => vis(c, t, 14.3 + i * 0.35, 20.75, { y: 80, d: 0.9 }));

        // S4
        s4Head.update(t, 21.0, 25.15);
        vis(s4Sub, t, 21.8, 25.15);
        vis(vcard.el, t, 21.2, 25.2, { x: 60, y: 0 });
        const refunded = Math.round(141 * prog(t, 22.5, 2.3, ease.inOutSine));
        vcard.set({ sold: 141, state: t < 21.9 ? "onSale" : "cancelled", m1: t < 21.9 ? "deadline today" : `${refunded} / 141 tickets refunded`, m2: t < 21.9 ? "14.1 SOL in escrow" : refunded >= 141 ? "escrow empty" : `${fmt((141 - refunded) * 0.1, 1)} SOL left in escrow` });
        feed.forEach((f, i) => vis(f, t, 21.8 + i * 0.45, 25.2, { x: 60, y: 0 }));
      };
    },
  };
})();
