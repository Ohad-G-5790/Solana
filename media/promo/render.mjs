// Renders the promo videos: steps each page's render(t) frame by frame in
// headless Chromium and pipes PNG frames into ffmpeg (H.264, 1920x1080).
//
//   NODE_PATH="$(npm root -g)" node media/promo/render.mjs                # all five
//   NODE_PATH="$(npm root -g)" node media/promo/render.mjs --only 3       # one video
//   NODE_PATH="$(npm root -g)" node media/promo/render.mjs --stills 2,9   # PNG stills only
//   NODE_PATH="$(npm root -g)" node media/promo/render.mjs --series phone --only a1,b4   # vertical series
//
// Needs Playwright (global install is fine, hence NODE_PATH) and ffmpeg on PATH.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "out");
const SERIES = {
  // Series 1: landscape explainers.
  main: {
    page: "src/index.html",
    w: 1920,
    h: 1080,
    out: OUT,
    names: { 1: "01-for-musicians", 2: "02-for-venues", 3: "03-cheaper-concerts", 4: "04-musicians-earn-more", 5: "05-end-the-monopoly" },
  },
  // Series 2: vertical, the musician's phone. a = one band's tour, b = five musicians, c = small vs big.
  phone: {
    page: "src/phone.html",
    w: 1080,
    h: 1920,
    out: join(OUT, "vertical"),
    names: {
      a1: "a1-tour-plan", a2: "a2-tour-book", a3: "a3-tour-sell", a4: "a4-tour-show-night", a5: "a5-tour-payday",
      b1: "b1-solo-artist", b2: "b2-diy-trio", b3: "b3-mid-size-band", b4: "b4-big-act", b5: "b5-session-drummer",
      c1: "c1-any-size-booking", c2: "c2-any-size-threshold", c3: "c3-any-size-every-ticket", c4: "c4-any-size-split", c5: "c5-any-size-record",
    },
  },
};

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const series = SERIES[arg("series") ?? "main"];
const NAMES = series.names;
const only = (arg("only") ?? Object.keys(NAMES).join(",")).split(",");
const fps = Number(arg("fps") ?? 60);
const stills = arg("stills")?.split(",").map(Number);
const DUR = 30;

mkdirSync(series.out, { recursive: true });
const browser = await chromium.launch();
for (const v of only) {
  const page = await browser.newPage({ viewport: { width: series.w, height: series.h }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error(`v${v} page error:`, e.message));
  await page.goto(`${pathToFileURL(join(here, series.page)).href}?v=${v}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 30_000 });
  const stage = page.locator("#stage");
  // CDP's speed-optimized PNG is lossless and about a third faster than page.screenshot.
  const cdp = await page.context().newCDPSession(page);
  const grab = async () => Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true })).data, "base64");

  if (stills) {
    mkdirSync(join(OUT, "stills"), { recursive: true });
    for (const t of stills) {
      await page.evaluate((x) => window.render(x), t);
      writeFileSync(join(OUT, "stills", `${NAMES[v]}-t${String(t).replace(".", "_")}.png`), await stage.screenshot({ type: "png" }));
    }
    console.log(`${NAMES[v]}: ${stills.length} stills`);
    await page.close();
    continue;
  }

  const file = join(series.out, `${NAMES[v]}.mp4`);
  const ff = spawn(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
     "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(fps),
     "-movflags", "+faststart", "-metadata", `title=Greenroom ${NAMES[v]}`, file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const frames = Math.round(DUR * fps);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((x) => window.render(x), f / fps);
    const png = await grab();
    if (!ff.stdin.write(png)) await once(ff.stdin, "drain");
    if (f % (fps * 5) === 0) process.stdout.write(`\r${NAMES[v]}: ${f}/${frames} frames`);
  }
  ff.stdin.end();
  const [code] = await once(ff, "close");
  if (code !== 0) throw new Error(`ffmpeg exited with ${code} for ${NAMES[v]}`);
  console.log(`\r${NAMES[v]}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${file}`);
  await page.close();
}
await browser.close();
