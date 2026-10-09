// b2 — Five musicians. Crimson Gardens, punk trio, 250 a night: the van -> the shortest loop -> local crew -> paid.
(() => {
  const { vis, prog, ease, clamp, lerp, h, fmt, makeMap, route, city, km } = GR;
  const { S, makePhone, pane, paneVis, add, title, splitBar, sceneText, eur } = PK;

  const LOOP = ["Hamburg", "Berlin", "Leipzig", "Dresden", "Prague", "Nuremberg", "Frankfurt", "Cologne"];
  const ZIGZAG = ["Hamburg", "Prague", "Cologne", "Dresden", "Frankfurt", "Berlin", "Nuremberg", "Leipzig"];
  const dist = (names) => names.slice(1).reduce((n, c, i) => n + km(city(names[i]), city(c)), 0);
  const BAD = Math.round(dist(ZIGZAG) / 10) * 10;
  const GOOD = Math.round(dist(LOOP) / 10) * 10;

  window.VIDEO = {
    kicker: "Crimson Gardens · punk trio",
    punch: "Less driving.\n{g:More left over.}",
    build(stage) {
      const ph = makePhone(stage, { me: "CG" });
      const BOX = { minLng: 5.2, maxLng: 16.4, minLat: 48.6, maxLat: 54.2 };
      const mapPane = (p, names, id, color) => {
        const host = add(p, "", "", { position: "relative", height: 620, borderRadius: 28, overflow: "hidden", background: "#161616", flex: "none" });
        const map = makeMap(host, 0, 0, 688, 620, BOX);
        const pts = names.map(city).map((c) => map.proj(c.lat, c.lng));
        const rt = route(map, pts, id);
        if (color) {
          rt.path.setAttribute("stroke", color);
          rt.glow.setAttribute("stroke", "rgba(243,114,127,0.18)");
        }
        names.forEach((n, i) => {
          const [x, y] = pts[i];
          map.mk("circle", { cx: x, cy: y, r: 9, fill: color ?? "#1ed760", stroke: "#161616", "stroke-width": 3 }, map.gTop);
          const side = { Frankfurt: "left", Leipzig: "left", Cologne: "below", Prague: "below" }[n] ?? "right";
          const tx = map.mk("text", { x: side === "right" ? x + 14 : side === "left" ? x - 14 : x, y: side === "below" ? y + 34 : y + 7, fill: "#e6e6e6", "font-size": 22, "font-weight": 700, "text-anchor": side === "right" ? "start" : side === "left" ? "end" : "middle" }, map.gTop);
          tx.textContent = n;
        });
        return rt;
      };

      const t1 = sceneText(stage, { a: S[0][0], b: S[0][1], label: "Punk trio · 250 a night", lc: "r", head: "We're a punk trio.\n{r:I drive the van.}", sub: "Every kilometre comes out of our pocket." });
      const p1 = pane(ph);
      title(p1, "Last tour", "8 cities, booked one email at a time");
      const r1 = mapPane(p1, ZIGZAG, "b2a", "#f3727f");
      const k1 = add(p1, "prow row between", `<span style="color:#b3b3b3">Distance</span><b class="n" style="font-size:40px;color:var(--negative)">0 km</b>`);
      const k1n = k1.querySelector(".n");

      const t2 = sceneText(stage, { a: S[1][0], b: S[1][1], label: "With Greenroom", lc: "g", head: "Our agent planned\n{g:the shortest loop.}", sub: "Same 8 cities, with rest days." });
      const p2 = pane(ph);
      title(p2, "This tour", "Planned by our agent");
      const r2 = mapPane(p2, LOOP, "b2b");
      const k2 = add(p2, "prow row between", `<span style="color:#b3b3b3">Distance</span><span><b class="n" style="font-size:40px">0 km</b> <span class="pill g sv" style="font-size:22px;margin-left:10px">−${fmt(BAD - GOOD)} km</span></span>`);
      const k2n = k2.querySelector(".n");
      const sv = k2.querySelector(".sv");

      const t3 = sceneText(stage, { a: S[2][0], b: S[2][1], head: "We don't carry a sound guy.\n{g:We hire one in every city.}" });
      const p3 = pane(ph);
      title(p3, "Crew", "Local, per show, paid from the split");
      const CREW = [
        ["Hamburg", "Mia K.", "sound engineer", "4%"],
        ["Berlin", "Jan F.", "sound engineer", "4%"],
        ["Leipzig", "Katrin W.", "sound engineer", "4%"],
        ["Dresden", "Nico W.", "sound engineer", "3%"],
        ["Prague", "Tomáš R.", "sound engineer", "4%"],
      ];
      const crew = CREW.map(([c, n, r, a]) => add(p3, "prow row between", `<div><b style="font-size:28px">${c}</b><div style="font-size:23px;color:#b3b3b3;margin-top:2px">${n} · ${r}</div></div><span class="pill g" style="font-size:22px">Hired · ${a}</span>`, { padding: "20px 26px" }));

      const t4 = sceneText(stage, { a: S[3][0], b: S[3][1], head: "Hamburg sold out.\n{g:€2,475 to the three of us.}" });
      const p4 = pane(ph);
      title(p4, "Hamburg · Molotow", "250 tickets × €15 = €3,750");
      const card = add(p4, "prow");
      const sb = splitBar(card, [
        { label: "Crimson Gardens · 66%", pct: 66, color: "var(--accent)", amount: "€2,475" },
        { label: "Molotow · 30%", pct: 30, color: "#e6e6e6", amount: "€1,125" },
        { label: "Mia K. · sound · 4%", pct: 4, color: "var(--info)", amount: "€150" },
      ], { hgt: 56, mt: 0 });
      const each = add(p4, "prow", `<div class="k">Each of us, the morning after</div><div class="big">€825</div>`);

      return (t) => {
        ph.show(t, 0.2, PK.END - 0.4);
        ph.setTime(t < S[1][0] ? "02:10" : t < S[3][0] ? "11:15" : "08:40");

        t1(t);
        paneVis(p1, t, 0.5, S[0][1]);
        const a = prog(t, 1.4, 2.8, ease.inOutCubic);
        r1.set(a);
        vis(k1, t, 1.2, null, { y: 20, d: 0.5 });
        k1n.textContent = `${fmt(Math.round(BAD * a))} km`;

        t2(t);
        paneVis(p2, t, S[1][0] + 0.1, S[1][1]);
        const b = prog(t, 7.4, 2.4, ease.inOutCubic);
        r2.set(b);
        vis(k2, t, 7.2, null, { y: 20, d: 0.5 });
        k2n.textContent = `${fmt(Math.round(GOOD * b))} km`;
        vis(sv, t, 10.0, null, { y: 0, s: 0.6, d: 0.5, ease: ease.outBack });

        t3(t);
        paneVis(p3, t, S[2][0] + 0.1, S[2][1]);
        crew.forEach((e, i) => vis(e, t, 13.3 + i * 0.45, null, { x: 40, y: 0, d: 0.5 }));

        t4(t);
        paneVis(p4, t, S[3][0] + 0.1, S[3][1]);
        vis(card, t, 19.8, null, { y: 20, d: 0.5 });
        sb.set(prog(t, 20.1, 1.0, ease.inOutCubic), t, 20.7);
        vis(each, t, 22.2, null, { y: 20, s: 0.95, d: 0.6, ease: ease.outBack });
      };
    },
  };
})();
