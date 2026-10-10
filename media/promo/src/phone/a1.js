// a1 — One band, one tour. Chapter 1: Plan. Four months of email -> one brief -> offers -> a route.
(() => {
  const { abs, vis, prog, ease, clamp, lerp, h, fmt, typed, makeMap, route, city } = GR;
  const { S, makePhone, pane, paneVis, add, title, notifStack, sceneText, TOUR } = PK;

  window.VIDEO = {
    kicker: "Chapter 1 · Plan",
    punch: "I planned a tour\n{g:before lunch.}",
    build(stage) {
      const ph = makePhone(stage, { me: "CR" });
      const appbar = ph.el.querySelector(".ph-appbar");

      // S1: the old way
      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Booking the old way", lc: "r", head: "Booking our last tour\ntook me {r:four months.}" });
      const p1 = pane(ph);
      p1.style.top = "-96px";
      const mailHead = add(p1, "row between", `<span class="pt">Inbox</span><span class="pill outline-r num" style="font-size:24px"><span class="n">0</span>&nbsp;unread</span>`);
      const unread = mailHead.querySelector(".n");
      const MAIL = [
        ["VM", "Venue · Munich", "Still no answer on the 12th…"],
        ["BK", "Booker", "Invoice: commission, November run"],
        ["VD", "Venue · Dresden", "Send past settlement sheets first"],
        ["PR", "Promoter · Vienna", "Can you guarantee 300 tickets?"],
        ["VP", "Venue · Prague", "Sorry, the 7th is gone. The 22nd?"],
        ["BK", "Booker", "Re: Re: Fwd: November routing??"],
        ["VL", "Venue · Leipzig", "Deposit required to hold the date"],
      ];
      const mails = MAIL.map(([i, w, s]) =>
        add(p1, "prow row", `<div style="flex:none;width:64px;height:64px;border-radius:50%;background:#2e2e2e;color:#cbcbcb;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center">${i}</div><div style="flex:1;min-width:0"><b style="font-size:28px">${w}</b><div style="font-size:24px;color:#b3b3b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</div></div><div style="flex:none;width:14px;height:14px;border-radius:50%;background:var(--info)"></div>`, { gap: "22px", padding: "20px 24px" }),
      );

      // S2: one brief
      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], label: "With Greenroom", lc: "g", head: "This time I wrote\n{g:one brief.}" });
      const p2 = pane(ph);
      title(p2, "New tour", "Tell your agent what you want.");
      const FIELDS = [
        ["When", "November 2026"],
        ["Where", "Germany · Czechia · Austria"],
        ["Shows", "8"],
        ["We draw", "about 400 people"],
        ["Ticket", "€25"],
      ];
      const fields = FIELDS.map(([k, v], i) => {
        const e = add(p2, "prow", `<div class="k">${k}</div><div class="v" style="font-size:34px;font-weight:700;color:#fff;margin-top:6px;min-height:42px"></div>`);
        return { e, v: e.querySelector(".v"), text: v, at: 7.0 + i * 0.85 };
      });
      const send = add(p2, "pbtn", "Send to my agent", { marginTop: 10 });

      // S3: offers come in
      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "My agent did\n{g:all the talking.}" });
      const p3 = pane(ph);
      title(p3, "Offers", "Venue agents are answering your brief.");
      const tiles = add(p3, "row", "", { gap: "18px" });
      const tile = (k) => {
        const e = h("div", "prow", `<div class="k">${k}</div><div class="big n">0</div>`, { flex: 1 });
        tiles.appendChild(e);
        return e.querySelector(".n");
      };
      const nOff = tile("Offers");
      const nDec = tile("Declined");
      const planning = add(p3, "prow row", `<span class="spin" style="width:34px;height:34px;border-radius:50%;border:5px solid #333;border-top-color:var(--accent);display:inline-block"></span><span>Planning the route…</span>`, { gap: "20px" });
      const spin = planning.querySelector(".spin");
      const notes = notifStack(stage, 64, 1010, 952, [
        { at: 13.4, title: "Offer · Lido, Berlin", body: "400 tickets · 30% to the venue · 15 free days" },
        { at: 14.3, title: "Offer · Conne Island, Leipzig", body: "400 tickets · 30% to the venue · 12 free days" },
        { at: 15.2, title: "Declined · Columbiahalle, Berlin", body: "Draw 400 is too small for a 3,500-cap room." },
        { at: 16.1, title: "Offer · Palác Akropolis, Prague", body: "400 tickets · 30% to the venue · 9 free days" },
      ]);

      // S4: the route
      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "{g:8 shows. 10 days.}\nA route that makes sense." });
      const p4 = pane(ph);
      title(p4, "November tour", "Planned by your agent · 2 rest days");
      const mapHost = add(p4, "", "", { position: "relative", height: 560, borderRadius: 28, overflow: "hidden", background: "#161616", flex: "none" });
      const map = makeMap(mapHost, 0, 0, 688, 560, { minLng: 10.2, maxLng: 17.9, minLat: 47.1, maxLat: 53.0 });
      const pts = TOUR.stops.map((s) => city(s.city)).map((c) => map.proj(c.lat, c.lng));
      const rt = route(map, pts, "a1");
      const stopEls = pts.map(([x, y], i) => {
        const g = map.mk("g", { opacity: 0 }, map.gTop);
        map.mk("circle", { cx: x, cy: y, r: 11, fill: "#1ed760", stroke: "#161616", "stroke-width": 4 }, g);
        const left = ["Leipzig", "Munich", "Salzburg"].includes(TOUR.stops[i].city);
        const tx = map.mk("text", { x: left ? x - 18 : x + 18, y: y + 8, fill: "#e6e6e6", "font-size": 24, "font-weight": 700, "text-anchor": left ? "end" : "start" }, g);
        tx.textContent = TOUR.stops[i].city;
        return { g, at: rt.at(i) };
      });
      const legs = TOUR.stops.slice(0, 4).map((s) =>
        add(p4, "prow row between", `<span><b>${s.city}</b> <span style="color:#b3b3b3">· ${s.venue}</span></span><span style="color:#b3b3b3">${s.date}</span>`, { padding: "18px 26px" }),
      );

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[1][0] ? "23:48" : t < S[3][0] ? "09:12" : "11:40");
        appbar.style.opacity = clamp((t - S[1][0] - 0.2) / 0.4).toFixed(3);

        t1(t);
        vis(p1, t, 0.6, S[0][1], { y: 0, d: 0.3, ox: -110, oy: 0 });
        mails.forEach((m, i) => vis(m, t, 0.9 + i * 0.32, null, { y: -24, d: 0.45, ease: ease.outCubic }));
        unread.textContent = Math.round(lerp(0, 47, prog(t, 0.9, 3.4, ease.inOutSine)));

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        fields.forEach(({ e, v, text, at }) => {
          vis(e, t, at - 0.5, null, { y: 20, d: 0.45 });
          const s = typed(text, t, at, 30);
          v.innerHTML = `${s}${t >= at && s.length < text.length ? '<span class="caret" style="height:32px"></span>' : ""}`;
        });
        vis(send, t, 10.9, null, { y: 20, s: 0.9, d: 0.5, ease: ease.outBack });
        if (t > 11.5 && t < 11.75) send.style.transform += " scale(0.95)";

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        nOff.textContent = Math.round(23 * prog(t, 13.3, 4.0, ease.inOutSine));
        nDec.textContent = Math.round(31 * prog(t, 13.3, 4.0, ease.inOutSine));
        vis(planning, t, 17.2, null, { y: 20, d: 0.5 });
        spin.style.transform = `rotate(${(t * 360) % 360}deg)`;
        notes(t, 17.3);

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        const rp = prog(t, 19.8, 2.0, ease.inOutCubic);
        rt.set(rp);
        stopEls.forEach(({ g, at }) => g.setAttribute("opacity", (clamp((rp - at + 0.04) / 0.04) * clamp((t - 19.8) / 0.25)).toFixed(3)));
        legs.forEach((l, i) => vis(l, t, 21.6 + i * 0.25, null, { y: 20, d: 0.5 }));
      };
    },
  };
})();
