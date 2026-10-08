// 01 — For musicians: months of email and all the risk -> an agent, a route, escrow.
(() => {
  const { abs, vis, prog, ease, clamp, lerp, headline, showCard, makeMap, route, city, km, typed, fmt, h } = GR;

  window.VIDEO = {
    num: "01",
    title: "For musicians",
    punch: "Book the tour.\n{g:Skip the risk.}",
    build(stage) {
      const L = abs(stage, "layer", "", 0, 0);

      // ---------- S1: the inbox ----------
      const s1Label = abs(L, "label r", "The problem for musicians", 120, 262);
      const s1Head = headline(L, "Booking a tour\ntakes {r:months}\nof email.", 120, 310, { size: 104, width: 840 });
      const s1Sub = abs(L, "sub", "Between the band, a booker and dozens of venues. Holds, deposits, guarantees, chasers.", 120, 676, { width: 760 });

      const inbox = abs(L, "card", "", 1010, 196, { width: 790, height: 714, padding: 0, overflow: "hidden" });
      const head = h("div", "row between", `<span style="font-size:34px;font-weight:700">Inbox</span><span class="pill outline-r num" style="font-size:22px"><span class="cnt">0</span>&nbsp;unread</span>`, { padding: "30px 34px 22px" });
      inbox.appendChild(head);
      const cnt = head.querySelector(".cnt");
      const mails = [
        ["VL", "Venue · Leipzig", "Re: Nov 4 — deposit required to hold", "Mon"],
        ["BK", "Booker", "Re: Re: Fwd: November routing??", "Tue"],
        ["VP", "Venue · Prague", "Sorry, the 7th is gone. Maybe the 22nd?", "Tue"],
        ["PR", "Promoter · Vienna", "Can you guarantee 300 tickets?", "Wed"],
        ["VD", "Venue · Dresden", "Send past settlement sheets first", "Thu"],
        ["BK", "Booker", "Invoice: commission, November run", "Fri"],
        ["VM", "Venue · Munich", "Still no answer on the 12th…", "Sat"],
      ];
      const ROW = 86;
      const rows = mails.map(([ini, who, subj, day], i) => {
        const r = h("div", "abs", `
          <div style="display:flex;align-items:center;gap:20px;height:${ROW - 10}px;padding:0 30px;background:#1f1f1f;border-radius:12px">
            <div style="flex:none;width:48px;height:48px;border-radius:50%;background:#2e2e2e;color:#cbcbcb;font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center">${ini}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:23px;font-weight:700;white-space:nowrap">${who}</div>
              <div style="font-size:21px;color:#b3b3b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subj}</div>
            </div>
            <div style="flex:none;font-size:19px;color:#8a8a8a">${day}</div>
            <div style="flex:none;width:12px;height:12px;border-radius:50%;background:var(--info)"></div>
          </div>`, { left: 20, width: 750 });
        inbox.appendChild(r);
        return { r, at: 0.9 + i * 0.5 };
      });

      // ---------- S2: the empty room ----------
      const s2Head = headline(L, "And if the room\nis half empty,\n{r:you pay for it.}", 120, 260, { size: 100, width: 900 });
      const s2Sub = abs(L, "sub", "Small and mid-size acts get the worst terms, or no tour at all.", 120, 616, { width: 760 });
      const room = abs(L, "card", "", 1030, 214, { width: 770, height: 650 });
      room.innerHTML = `<div class="row between"><div><div style="font-size:34px;font-weight:700">Thursday · Leipzig</div><div style="font-size:22px;color:#b3b3b3;margin-top:6px">Booked the old way</div></div><div class="num" style="font-size:30px;font-weight:700"><span class="sold">0</span><span style="color:#b3b3b3"> / 200</span></div></div>`;
      const seatsWrap = h("div", "", "", { position: "relative", marginTop: 34, height: 340 });
      room.appendChild(seatsWrap);
      const seats = [];
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 20; c++) {
          const s = h("div", "", "", { position: "absolute", left: c * 35, top: r * 34, width: 24, height: 24, borderRadius: "50%", background: "#262626" });
          seatsWrap.appendChild(s);
          seats.push(s);
        }
      // deterministic shuffle for which seats light up
      const order = seats.map((_, i) => i).sort((a, b) => ((a * 7919) % 211) - ((b * 7919) % 211));
      const soldEl = room.querySelector(".sold");
      const chipRow = h("div", "", "", { display: "flex", gap: "14px", marginTop: 40, flexWrap: "wrap" });
      room.appendChild(chipRow);
      const chips = ["Room deposit", "Booker's cut", "Fuel & hotels", "Unsold tickets"].map((c) => {
        const e = h("span", "pill outline-r", `− ${c}`, { fontSize: 22 });
        chipRow.appendChild(e);
        return e;
      });

      // ---------- S3: the agent and the route ----------
      const s3Label = abs(L, "label g", "With Greenroom", 120, 214);
      const s3Head = headline(L, "Your band gets\nan {g:AI agent.}", 120, 258, { size: 96, width: 800 });
      const briefK = abs(L, "label", "The brief", 120, 500, { fontSize: 18 });
      const brief = abs(L, "input", "", 120, 538, { width: 770, fontSize: 28, padding: "24px 34px" });
      const BRIEF = "November · Central Europe · 8 shows · we draw 400";
      const send = abs(L, "btn", "Send brief", 120, 650);
      const s3Sub = abs(L, "sub", "It negotiates with venue agents and plans the route. <b>In minutes, not months.</b>", 120, 776, { width: 780 });

      const mapBox = { minLng: 7.0, maxLng: 21.0, minLat: 46.2, maxLat: 54.2 };
      const map = makeMap(L, 940, 150, 900, 800, mapBox);
      map.wrap.style.webkitMaskImage = "radial-gradient(closest-side, #000 80%, transparent 100%)";
      const inBox = map.dots.filter((d) => d.x > 40 && d.x < 860 && d.y > 40 && d.y < 760);
      const offers = inBox.filter((_, i) => i % 2 === 0).slice(0, 26);
      const pings = offers.map((d, i) => ({ d, at: 14.2 + i * 0.06, ring: map.mk("circle", { cx: d.x, cy: d.y, r: 6, fill: "none", stroke: "#1ed760", "stroke-width": 2.5, opacity: 0 }, map.gTop) }));
      const offerPill = abs(L, "pill", `Offers in: <span class="num n" style="color:#fff">0</span>`, 980, 170, { fontSize: 22 });
      const STOPS = ["Berlin", "Leipzig", "Dresden", "Prague", "Brno", "Vienna", "Salzburg", "Munich"].map(city);
      const pts = STOPS.map((c) => map.proj(c.lat, c.lng));
      const rt = route(map, pts, "v1");
      const stopEls = STOPS.map((c, i) => {
        const [x, y] = pts[i];
        const g = map.mk("g", { opacity: 0 }, map.gTop);
        map.mk("circle", { cx: x, cy: y, r: 11, fill: "#1ed760", stroke: "#121212", "stroke-width": 3 }, g);
        const side = { Leipzig: "left", Munich: "left", Salzburg: "below" }[c.name] ?? "right";
        const lx = side === "right" ? x + 18 : side === "left" ? x - 18 : x;
        const ly = side === "below" ? y + 40 : y + 7;
        const anchor = side === "right" ? "start" : side === "left" ? "end" : "middle";
        const tx = map.mk("text", { x: lx, y: ly, fill: "#e6e6e6", "font-size": 22, "font-weight": 700, "text-anchor": anchor }, g);
        tx.textContent = `${i + 1}. ${c.name}`;
        return { g, at: rt.at(i) };
      });
      const distPill = abs(L, "pill g", "8 shows · 10 days · 2 rest days", 1240, 884, { fontSize: 22 });

      // ---------- S4: escrow and threshold ----------
      const s4Head = headline(L, "Fans pay {g:into escrow}, months early.", 120, 196, { size: 80, width: 1700 });
      const s4Sub = abs(L, "sub", "Hit 50% by the deadline and the show is on. Miss it, and every fan is refunded automatically.", 120, 300, { width: 1700 });
      const CARDS = [
        { city: "Berlin", venue: "Lido", day: 0, date: "Nov 3", capacity: 400, target: 318, curve: 1.0 },
        { city: "Leipzig", venue: "Conne Island", day: 1, date: "Nov 4", capacity: 400, target: 246, curve: 1.25 },
        { city: "Prague", venue: "Palác Akropolis", day: 4, date: "Nov 7", capacity: 400, target: 281, curve: 0.85 },
        { city: "Vienna", venue: "WUK", day: 6, date: "Nov 9", capacity: 400, target: 141, curve: 1.6 },
      ].map((d, i) => ({ d, c: showCard(L, 120 + i * 426, 420, 400, d) }));
      const chipRow4 = abs(L, "row", "", 120, 790, { gap: "20px" });
      const s4Chips = ["No deposit", "No booker's cut", "No empty-room risk"].map((t) => {
        const e = h("span", "pill outline-g", `✓ ${t}`, { fontSize: 26 });
        chipRow4.appendChild(e);
        return e;
      });

      return (t) => {
        // S1
        vis(s1Label, t, 0.25, 5.7, { y: 20 });
        s1Head.update(t, 0.4, 5.7);
        vis(s1Sub, t, 1.5, 5.7);
        vis(inbox, t, 0.5, 5.75, { y: 60, s: 0.97, d: 0.9 });
        rows.forEach(({ r, at }, i) => {
          let y = 0;
          rows.forEach((o, j) => {
            if (j > i) y += ROW * prog(t, o.at, 0.45, ease.outCubic);
          });
          r.style.top = `${100 + y}px`;
          vis(r, t, at, null, { y: -30, d: 0.45, ease: ease.outCubic });
        });
        cnt.textContent = Math.round(lerp(0, 47, prog(t, 0.9, 3.6, ease.inOutSine)));

        // S2
        s2Head.update(t, 6.05, 11.1);
        vis(s2Sub, t, 7.3, 11.1);
        vis(room, t, 6.3, 11.15, { y: 60, s: 0.97, d: 0.9 });
        const lit = Math.round(96 * prog(t, 6.8, 1.6, ease.outCubic));
        order.forEach((idx, k) => (seats[idx].style.background = k < lit ? "#cbcbcb" : "#262626"));
        soldEl.textContent = lit;
        chips.forEach((c, i) => vis(c, t, 8.6 + i * 0.3, null, { y: 20, s: 0.8, d: 0.5, ease: ease.outBack }));

        // S3
        vis(s3Label, t, 11.45, 19.0, { y: 20 });
        s3Head.update(t, 11.55, 19.0);
        vis(briefK, t, 11.9, 19.0, { y: 16 });
        vis(brief, t, 11.9, 19.0, { y: 30 });
        const tb = typed(BRIEF, t, 12.25, 34);
        brief.innerHTML = `<span>${tb}</span>${t < 19 ? `<span class="caret" style="opacity:${Math.floor(t * 2.4) % 2 || tb.length < BRIEF.length ? 1 : 0}"></span>` : ""}`;
        const press = t > 14.0 && t < 14.3 ? 0.94 : 1;
        vis(send, t, 13.75, 19.0, { y: 20, s: 0.8, ease: ease.outBack, d: 0.5 });
        if (t > 14.0 && t < 19.0) send.style.transform += ` scale(${press})`;
        vis(s3Sub, t, 16.4, 19.0);
        vis(map.wrap, t, 12.0, 19.05, { y: 0, s: 1.04, d: 1.4, ease: ease.outCubic });
        let n = 0;
        pings.forEach(({ d, at, ring }) => {
          const p = clamp((t - at) / 0.9);
          ring.setAttribute("r", (6 + p * 34).toFixed(1));
          ring.setAttribute("opacity", t < at ? 0 : (1 - p).toFixed(3));
          if (t >= at) n++;
          d.el.setAttribute("fill", t >= at ? "#1ed760" : "#5a5a5a");
          d.el.setAttribute("r", t >= at ? 5.5 : 4.5);
          d.el.setAttribute("opacity", t >= at ? 0.55 : 1);
        });
        vis(offerPill, t, 14.1, 19.0, { y: -14 });
        offerPill.querySelector(".n").textContent = n;
        const rp = prog(t, 15.9, 2.1, ease.inOutCubic);
        rt.set(rp);
        stopEls.forEach(({ g, at }) => g.setAttribute("opacity", (clamp((rp - at + 0.04) / 0.04) * clamp((t - 15.9) / 0.25)).toFixed(3)));
        vis(distPill, t, 18.0, 19.0, { y: 20, s: 0.9, ease: ease.outBack, d: 0.5 });

        // S4
        s4Head.update(t, 19.45, 25.15);
        vis(s4Sub, t, 20.0, 25.15);
        CARDS.forEach(({ d, c }, i) => {
          vis(c.el, t, 20.2 + i * 0.12, 25.2, { y: 80, d: 0.9 });
          const p = prog(t, 20.7 + i * 0.1, 2.5, (x) => 1 - Math.pow(1 - x, 1.6 * d.curve));
          const sold = Math.round(d.target * p);
          const need = d.capacity / 2;
          const deadlineAt = 23.4;
          let state = "onSale";
          if (sold >= need) state = "confirmed";
          else if (t >= deadlineAt) state = "cancelled";
          const daysLeft = Math.max(0, Math.ceil(lerp(21, 0, clamp((t - 20.6) / (deadlineAt - 20.6)))));
          c.set({
            sold,
            state,
            m1: state === "onSale" ? `deadline in ${daysLeft} days` : state === "confirmed" ? "settles after the show" : `${sold} fans refunded`,
            m2: state === "cancelled" ? "" : `${fmt(sold * 0.1, 1)} SOL`,
          });
        });
        s4Chips.forEach((c, i) => vis(c, t, 23.8 + i * 0.22, 25.2, { y: 24, s: 0.85, ease: ease.outBack, d: 0.55 }));
      };
    },
  };
})();
