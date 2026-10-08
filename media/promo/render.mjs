// Renders the promo videos: steps each page's render(t) frame by frame in
// headless Chromium and pipes PNG frames into ffmpeg (H.264, 1920x1080).
//
//   NODE_PATH="$(npm root -g)" node media/promo/render.mjs                # all five
//   NODE_PATH="$(npm root -g)" node media/promo/render.mjs --only 3       # one video
//   NODE_PATH="$(npm root -g)" node media/promo/render.mjs --stills 2,9   # PNG stills only
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
const NAMES = {
  1: "01-for-musicians",
  2: "02-for-venues",
  3: "03-cheaper-concerts",
  4: "04-musicians-earn-more",
  5: "05-end-the-monopoly",
};

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const only = (arg("only") ?? "1,2,3,4,5").split(",").map(Number);
const fps = Number(arg("fps") ?? 60);
const stills = arg("stills")?.split(",").map(Number);
const DUR = 30;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const v of only) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error(`v${v} page error:`, e.message));
  await page.goto(`${pathToFileURL(join(here, "src/index.html")).href}?v=${v}`);
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

  const file = join(OUT, `${NAMES[v]}.mp4`);
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
