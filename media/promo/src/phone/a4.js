// a4 — One band, one tour. Chapter 4: Show night. Hire local crew -> crew in the split -> the room -> settlement.
(() => {
  const { vis, prog, ease, clamp, h, fmt } = GR;
  const { S, makePhone, pane, paneVis, add, title, splitBar, notifStack, sceneText } = PK;

  const crewRow = (p, ini, name, role, meta, ask) =>
    add(p, "prow row", `<div style="flex:none;width:72px;height:72px;border-radius:50%;background:#2e2e2e;color:#e6e6e6;font-weight:700;font-size:24px;display:flex;align-items:center;justify-content:center">${ini}</div><div style="flex:1"><b style="font-size:30px">${name}</b><div style="font-size:24px;color:#b3b3b3;margin-top:2px">${role}</div><div style="font-size:22px;color:#8a8a8a;margin-top:2px">${meta}</div></div><div style="text-align:right"><div style="font-size:30px;font-weight:800;color:#fff">${ask}</div><span class="hire pill outline-g" style="font-size:20px;padding:6px 18px;margin-top:8px">Hire</span></div>`, { gap: "22px" });

  window.VIDEO = {
    kicker: "Chapter 4 · Show night",
    punch: "I play the show.\n{g:The deal does the rest.}",
    build(stage) {
      const ph = makePhone(stage, { me: "CR" });

      // S1: crew pitches
      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Leipzig is confirmed", lc: "g", head: "Now I need\n{g:a sound engineer.}" });
      const p1 = pane(ph);
      title(p1, "Crew in Leipzig", "Local crew agents pitching for Nov 4");
      const crew = [
        crewRow(p1, "KW", "Katrin W.", "Sound engineer", "★ 4.8 · 9 years", "4%"),
        crewRow(p1, "ML", "Max L.", "Sound engineer", "★ 4.6 · 5 years", "3%"),
        crewRow(p1, "TW", "Till W.", "Backline tech", "★ 4.9 · 7 years", "3%"),
      ];
      const hireBtn = crew[0].querySelector(".hire");

      // S2: crew joins the split
      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], head: "I hired her from my phone.\n{g:She's paid from the split.}" });
      const p2 = pane(ph);
      title(p2, "Deal · Leipzig, Nov 4", "Conne Island · 400 tickets");
      const card = add(p2, "prow", `<div class="k">Split</div>`);
      const before = splitBar(card, [
        { label: "Band", pct: 70, color: "var(--accent)", amount: "70%" },
        { label: "Conne Island", pct: 30, color: "#e6e6e6", amount: "30%" },
      ], { hgt: 48, mt: 14 });
      const card2 = add(p2, "prow", `<div class="k">Split, with crew</div>`);
      const after = splitBar(card2, [
        { label: "Band", pct: 66, color: "var(--accent)", amount: "66%" },
        { label: "Conne Island", pct: 30, color: "#e6e6e6", amount: "30%" },
        { label: "Katrin W. · sound", pct: 4, color: "var(--info)", amount: "4%" },
      ], { hgt: 48, mt: 14 });
      const n2 = notifStack(stage, 64, 1330, 952, [{ at: 9.6, title: "Katrin W. joined the deal", body: "Sound engineer · 4% · paid when the show settles" }]);

      // S3: the room
      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "Show night. {g:318 people.}\nEvery one paid upfront." });
      const p3 = pane(ph);
      title(p3, "Tonight", "Conne Island, Leipzig · doors 20:00");
      const room = add(p3, "prow", "", { position: "relative", height: 560 });
      const dots = [];
      for (let r = 0; r < 16; r++)
        for (let c = 0; c < 25; c++) {
          const d = h("div", "", "", { position: "absolute", left: 30 + c * 25.5, top: 120 + r * 26, width: 16, height: 16, borderRadius: "50%", background: "#2a2a2a" });
          room.appendChild(d);
          dots.push(d);
        }
      room.insertAdjacentHTML("afterbegin", `<div class="row between" style="position:absolute;left:28px;right:28px;top:24px"><span class="k">In the room</span><span style="font-size:30px;font-weight:800"><span class="n">0</span><span style="color:#8a8a8a"> / 400</span></span></div><div style="position:absolute;left:28px;top:66px;font-size:24px;color:#b3b3b3">Stage ↑</div>`);
      const nRoom = room.querySelector(".n");
      const order = dots.map((_, i) => i).sort((a, b) => ((a * 7919) % 401) - ((b * 7919) % 401));
      const esc = add(p3, "prow row between", `<span style="color:#b3b3b3">In escrow</span><b style="font-size:34px">€7,950</b>`);

      // S4: settlement
      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "When the night ends,\n{g:the deal settles itself.}" });
      const p4 = pane(ph);
      title(p4, "Settlement", "Leipzig · Nov 4");
      const STEPS = ["Show date passed", "settle_show sent on Solana", "Band paid", "Conne Island paid", "Katrin W. paid"];
      const steps = STEPS.map((s) => {
        const e = add(p4, "prow row", `<span class="ck" style="flex:none;width:52px;height:52px;border-radius:50%;box-shadow:inset 0 0 0 3px #3a3a3a;display:flex;align-items:center;justify-content:center"></span><span style="font-size:30px">${s}</span>`, { gap: "22px" });
        return { e, ck: e.querySelector(".ck") };
      });

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[2][0] ? "14:02" : t < S[3][0] ? "21:47" : "00:14");

        t1(t);
        paneVis(p1, t, 0.5, S[0][1]);
        crew.forEach((e, i) => vis(e, t, 1.2 + i * 0.4, null, { y: 24, d: 0.5 }));
        const hired = t > 4.4;
        hireBtn.className = `hire pill ${hired ? "g" : "outline-g"}`;
        hireBtn.textContent = hired ? "Hired ✓" : "Hire";
        crew[0].style.boxShadow = `inset 0 0 0 ${(3 * prog(t, 4.4, 0.4)).toFixed(2)}px var(--accent)`;

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        vis(card, t, 6.9, null, { y: 20, d: 0.5 });
        before.set(prog(t, 7.1, 0.7, ease.inOutCubic), t, 7.5);
        vis(card2, t, 8.6, null, { y: 20, d: 0.5 });
        after.set(prog(t, 8.9, 0.8, ease.inOutCubic), t, 9.4);
        n2(t, 12.2);

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        vis(room, t, 13.3, null, { y: 20, d: 0.5 });
        const n = Math.round(318 * prog(t, 13.6, 3.2, ease.inOutSine));
        order.forEach((idx, k) => (dots[idx].style.background = k < n ? "var(--accent)" : "#2a2a2a"));
        nRoom.textContent = n;
        vis(esc, t, 15.6, null, { y: 20, d: 0.5 });

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        steps.forEach(({ e, ck }, i) => {
          const at = 19.9 + i * 0.75;
          vis(e, t, at - 0.3, null, { y: 20, d: 0.45 });
          const done = t > at + 0.3;
          ck.style.background = done ? "var(--accent)" : "transparent";
          ck.style.boxShadow = done ? "none" : "inset 0 0 0 3px #3a3a3a";
          ck.innerHTML = done ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>` : "";
        });
      };
    },
  };
})();
