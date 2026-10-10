// c1 — Small vs big. Booking: same brief, offers from rooms their size, a route each, on sale the same day.
(() => {
  const { vis, prog, ease, clamp, h, makeMap, route, city } = GR;
  const { S, pane, paneVis, add, bigTitle: title, duo, duoText, bigCard, bigRow, LENA, RUSTY } = PK;

  const LROUTE = ["Frankfurt", "Nuremberg", "Plzeň", "Brno", "Linz", "Innsbruck"];
  const RROUTE = ["Cologne", "Berlin", "Leipzig", "Dresden", "Prague", "Munich"];

  window.VIDEO = {
    kicker: "Small or big · Booking",
    punch: "Small or big,\n{g:book it yourself.}",
    build(stage) {
      const d = duo(stage, LENA, RUSTY);
      const both = (fn) => [fn(d.L, LENA, 0), fn(d.R, RUSTY, 1)];
      const sc = (i, L, R, foot) => duoText(stage, { a: S[i][0], b: S[i][1], L, R, foot });

      const t1 = sc(0, "I draw {g:150.}", "We draw {g:3,500.}", "Same app.\n{g:Same agent.}");
      const p1 = both((ph, a) => {
        const p = pane(ph);
        title(p, "New tour");
        const rows = [bigRow(p, "Shows", "6"), bigRow(p, "Rooms", a === LENA ? "~150" : "~3,500"), bigRow(p, "Ticket", `€${a.price}`)];
        const btn = add(p, "pbtn", "Send", { height: 110, fontSize: 34, marginTop: 8 });
        return { p, rows, btn };
      });

      const t2 = sc(1, "Six small rooms\n{g:said yes.}", "Six big rooms\n{g:said yes.}", "Venue agents answer\n{g:any size.}");
      const p2 = both((ph, a) => {
        const p = pane(ph);
        title(p, "6 offers");
        const V = a === LENA ? [["Kabinet múz", "230"], ["Club Stereo", "200"], ["Nachtleben", "250"], ["p.m.k", "250"]] : [["Columbiahalle", "3,500"], ["Forum Karlín", "3,000"], ["Haus Auensee", "2,500"], ["E-Werk", "2,000"]];
        return { p, rows: V.map(([n, c]) => bigRow(p, n, c, { color: "#b3b3b3" })) };
      });

      const t3 = sc(2, "My route:\n{g:6 cities.}", "Ours:\n{g:6 cities.}", "Planned in {g:minutes.}");
      const p3 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Route");
        const host = add(p, "", "", { position: "relative", height: 760, borderRadius: 32, overflow: "hidden", background: "#161616", flex: "none" });
        const box = a === LENA ? { minLng: 7.6, maxLng: 17.6, minLat: 46.6, maxLat: 51.0 } : { minLng: 5.8, maxLng: 15.6, minLat: 47.4, maxLat: 53.4 };
        const map = makeMap(host, 0, 0, 688, 760, box);
        const names = a === LENA ? LROUTE : RROUTE;
        const pts = names.map(city).map((c) => map.proj(c.lat, c.lng));
        const rt = route(map, pts, `c1${a.me}`);
        rt.path.setAttribute("stroke-width", 7);
        const stops = pts.map(([x, y], i) => {
          const g = map.mk("g", { opacity: 0 }, map.gTop);
          map.mk("circle", { cx: x, cy: y, r: 18, fill: "#1ed760", stroke: "#161616", "stroke-width": 5 }, g);
          if (i === 0 || i === names.length - 1) {
            const anchor = x < 200 ? "start" : x > 488 ? "end" : "middle";
            const tx = map.mk("text", { x: anchor === "start" ? x - 18 : anchor === "end" ? x + 18 : x, y: y + (y > 380 ? 64 : -34), fill: "#fff", "font-size": 44, "font-weight": 800, "text-anchor": anchor }, g);
            tx.textContent = names[i];
          }
          return { g, at: rt.at(i) };
        });
        return { p, rt, stops };
      });

      const t4 = sc(3, "On sale\n{g:today.}", "On sale\n{g:today.}", "Any size.\n{g:Same tools.}");
      const p4 = both((ph, a) => {
        const p = pane(ph);
        title(p, "Shows");
        const C = a === LENA ? ["Frankfurt", "Nuremberg", "Plzeň", "Brno", "Linz"] : ["Cologne", "Berlin", "Leipzig", "Dresden", "Prague"];
        return { p, rows: C.map((c) => bigRow(p, c, `<span class="badge onSale" style="font-size:28px">on sale</span>`)) };
      });

      return (t) => {
        d.show(t);
        [d.L, d.R].forEach((ph, k) => ph.setTime(t < S[3][0] ? "10:00" : "10:24"));

        t1(t);
        p1.forEach(({ p, rows, btn }, k) => {
          paneVis(p, t, 0.6 + k * 0.15, S[0][1]);
          rows.forEach((r, i) => vis(r, t, 1.4 + i * 0.35 + k * 0.15, null, { y: 20, d: 0.5 }));
          vis(btn, t, 2.8 + k * 0.15, null, { y: 20, s: 0.9, d: 0.5, ease: ease.outBack });
          if (t > 4.2 && t < 4.45) btn.style.transform += " scale(0.95)";
        });

        t2(t);
        p2.forEach(({ p, rows }, k) => {
          paneVis(p, t, S[1][0] + 0.1 + k * 0.15, S[1][1]);
          rows.forEach((r, i) => vis(r, t, 7.1 + i * 0.4 + k * 0.15, null, { x: 40, y: 0, d: 0.5 }));
        });

        t3(t);
        p3.forEach(({ p, rt, stops }, k) => {
          paneVis(p, t, S[2][0] + 0.1 + k * 0.15, S[2][1]);
          const rp = prog(t, 13.5 + k * 0.2, 2.4, ease.inOutCubic);
          rt.set(rp);
          stops.forEach(({ g, at }) => g.setAttribute("opacity", (clamp((rp - at + 0.04) / 0.04) * clamp((t - 13.5 - k * 0.2) / 0.25)).toFixed(3)));
        });

        t4(t);
        p4.forEach(({ p, rows }, k) => {
          paneVis(p, t, S[3][0] + 0.1 + k * 0.15, S[3][1]);
          rows.forEach((r, i) => vis(r, t, 19.8 + i * 0.3 + k * 0.15, null, { y: 20, d: 0.5 }));
        });
      };
    },
  };
})();
