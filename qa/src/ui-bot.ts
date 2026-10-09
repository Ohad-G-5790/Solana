/**
 * UI bot: drives the built dashboard in a real browser the way a band would
 * and checks that it is intuitive, not how it looks: one clear next step,
 * nothing personal before a wallet connects, your data right after, plain
 * words, named controls, the same controls everywhere, fast first paint even
 * when the chain is slow, no sideways scrolling on a phone.
 *
 *   npx tsx qa/src/ui-bot.ts                       builds the static site, prints the checks
 *   npx tsx qa/src/ui-bot.ts --no-build --shots qa/reports/ui
 *                                                  reuse the last build, save screenshots
 *
 * The wallet is a test wallet that holds only a public address and cannot
 * sign; devnet answers are faked inside the browser, so the bot needs no
 * network. UI_BOT_CHROMIUM points at a Chromium binary when Playwright's own
 * download is not available.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "playwright";

export interface UiCheck {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
}

export const UI_CHECKS: { id: string; title: string }[] = [
  { id: "ux-public-first", title: "the first screen is public: nothing personal until a wallet connects" },
  { id: "ux-connect-shows-mine", title: "connecting a wallet shows that wallet's own data right away" },
  { id: "ux-next-step", title: "a band without a tour sees one obvious next step" },
  { id: "ux-create-tour", title: "creating a tour takes four answers, shows the route and the drive home before anything is booked, and lets the band reorder it" },
  { id: "ux-booked-tour", title: "after booking, the dashboard shows your own tour in fans and euros: planned days, booked by you, what waits on whom, your show pages, your activity only, also on a phone" },
  { id: "ux-fast-paint", title: "every page shows its heading within 1.5 s even when the chain answers slowly" },
  { id: "ux-phone-width", title: "no sideways scrolling at phone width (390 px)" },
  { id: "ux-names", title: "every button, link and field has an accessible name" },
  { id: "ux-headings-nav", title: "one main heading per page and the current page is marked in the navigation" },
  { id: "ux-plain-language", title: "band-facing pages speak plainly (no lamports, bps, PDAs or shell commands)" },
  { id: "ux-shared-controls", title: "buttons come from the shared set (btn, chip, choice, icon) so they look and behave alike" },
  { id: "ux-activity-grouped", title: "the agent feed tells the tour in phases, says who speaks, and starts compact" },
  { id: "ux-guest-path", title: "visitors without a wallet can still explore (demo band, venues, route planner)" },
];

const BASE = "/Solana";
const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const ADDRESS = "cSppNhmf1Ng2JAyf5UeNb7Di9mukwRDjBgcRXvTCfsj";
const PAGES = ["/", "/approvals/", "/venues/", "/planner/", "/band/", "/feed/", "/tour/new/"];
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".jsonl": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };

function serve(dir: string): Promise<Server> {
  const server = createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (!p.startsWith(BASE)) {
      res.writeHead(404).end();
      return;
    }
    p = p.slice(BASE.length) || "/";
    let file = join(dir, p);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
    if (!existsSync(file)) {
      res.writeHead(404, { "content-type": "text/html" }).end(existsSync(join(dir, "404.html")) ? readFileSync(join(dir, "404.html")) : "not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

/** The Show account's discriminator, base58 as RPC memcmp filters carry it. */
const SHOW_DISC_BYTES = Buffer.from(
  (JSON.parse(readFileSync(join(ROOT, "packages/web/src/idl/greenroom.json"), "utf8")) as { accounts: { name: string; discriminator: number[] }[] }).accounts.find((a) => a.name === "Show")!.discriminator
);
const SHOW_DISC = (() => {
  const bytes = [...SHOW_DISC_BYTES];
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) {
    out = A[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) if (b === 0) out = "1" + out; else break;
  return out;
})();

function b58(s: string): Uint8Array {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(A.indexOf(c));
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 255n);
    n >>= 8n;
  }
  return out;
}

/** BandProfile account bytes (discriminator from the IDL, borsh fields). */
function bandProfile(name: string, genre: string, toursCreated: number): string {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [Uint8Array.from([30, 82, 126, 201, 225, 188, 124, 31]), b58(ADDRESS)];
  for (const s of [name, genre]) {
    const b = enc.encode(s);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, b.length, true);
    parts.push(len, b);
  }
  const counters = new Uint8Array(24);
  new DataView(counters.buffer).setUint32(0, toursCreated, true);
  parts.push(counters, Uint8Array.from([255]));
  return Buffer.concat(parts.map((p) => Buffer.from(p))).toString("base64");
}

interface Fake {
  band: boolean;
  /** The band has booked a tour from the dashboard: three shows on chain. */
  tour?: boolean;
  /** ms every RPC answer waits (a slow public devnet). */
  delay: number;
}

/**
 * A Wallet Standard wallet that holds only a public address and cannot sign.
 * Plain JavaScript in a string: tsx would add helpers to a real function that
 * do not exist inside the page.
 */
const WALLET_SCRIPT = `(function (address) {
  var A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  var n = 0n;
  for (var c of address) n = n * 58n + BigInt(A.indexOf(c));
  var bytes = new Uint8Array(32);
  for (var i = 31; i >= 0; i--) { bytes[i] = Number(n & 255n); n >>= 8n; }
  var account = { address: address, publicKey: bytes, chains: ["solana:devnet"], features: ["solana:signTransaction"] };
  var listeners = [];
  var wallet = {
    version: "1.0.0",
    name: "Test Wallet",
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
    chains: ["solana:devnet"],
    accounts: [],
    features: {
      "standard:connect": { version: "1.0.0", connect: async function () { wallet.accounts = [account]; listeners.forEach(function (f) { f({ accounts: wallet.accounts }); }); return { accounts: wallet.accounts }; } },
      "standard:disconnect": { version: "1.0.0", disconnect: async function () { wallet.accounts = []; } },
      "standard:events": { version: "1.0.0", on: function (_e, f) { listeners.push(f); return function () {}; } },
      "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy", 0], signTransaction: async function () { throw new Error("test wallet cannot sign"); } }
    }
  };
  function register(api) { api.register(wallet); }
  window.addEventListener("wallet-standard:app-ready", function (e) { register(e.detail); });
  window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
})`;

/**
 * Three shows as a dashboard booking leaves them on chain, encoded with the
 * program's IDL: Berlin on sale (day 1), Leipzig waiting for its venue (day 3),
 * Hamburg confirmed (day 6). Dates follow the demo clock (2 s per tour day).
 */
async function bookedShows(root: string): Promise<Map<string, string>> {
  // CommonJS packages: the namespace or its default, whichever the loader gives
  const anchorMod = await import("@anchor-lang/core");
  const anchor = ((anchorMod as unknown as { default?: typeof anchorMod }).default ?? anchorMod) as typeof anchorMod;
  const bnMod = await import("bn.js");
  const BN = ((bnMod as { default?: unknown }).default ?? bnMod) as typeof import("bn.js");
  const { PublicKey, Keypair } = await import("@solana/web3.js");
  const idl = JSON.parse(readFileSync(join(root, "packages/web/src/idl/greenroom.json"), "utf8"));
  const venues = JSON.parse(readFileSync(join(root, "packages/web/public/venue-profiles.json"), "utf8")).venues as Record<string, { authority: string; profile: string }>;
  const coder = new anchor.BorshAccountsCoder(idl);
  const band = new PublicKey(ADDRESS);
  const PROGRAM = new PublicKey("4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8");
  const now = Math.floor(Date.now() / 1000);
  const plan: [string, number, string, number][] = [
    ["huxleys-neue-welt-berlin", 0, "OnSale", 4],
    ["taeubchenthal-leipzig", 2, "Proposed", 0],
    ["grosse-freiheit-36-hamburg", 5, "Confirmed", 12],
  ];
  const out = new Map<string, string>();
  // the tour itself, marked as booked in the dashboard (region APP_REGION)
  const bandProfile = PublicKey.findProgramAddressSync([Buffer.from("band"), band.toBuffer()], PROGRAM)[0];
  const tourId = Buffer.alloc(4);
  const tour = PublicKey.findProgramAddressSync([Buffer.from("tour"), bandProfile.toBuffer(), tourId], PROGRAM)[0];
  const tourData = await coder.encode("Tour", { band_profile: bandProfile, tour_id: 0, name: "The Running Pigeons tour 1", region: "Greenroom app", starts_at: new BN(now - 120), ends_at: new BN(now + 8 * 3600), shows_count: 3, bump: 255 });
  out.set(tour.toBase58(), Buffer.from(tourData).toString("base64"));
  for (const [id, day, state, sold] of plan) {
    const v = venues[id];
    const deadline = now + 1800 + day * 2;
    const data = await coder.encode("Show", {
      tour: PublicKey.default,
      band_profile: PublicKey.default,
      venue_profile: new PublicKey(v.profile),
      band_authority: band,
      venue_authority: new PublicKey(v.authority),
      date: new BN(deadline + 1800),
      ticket_price_lamports: new BN(200_000),
      capacity: 20,
      threshold_bps: 5000,
      threshold_deadline: new BN(deadline),
      band_bps: 6500,
      venue_bps: 3500,
      tickets_sold: sold,
      tickets_refunded: 0,
      escrow_lamports: new BN(sold * 200_000),
      state: { [state]: {} },
      bump: 255,
      vault_bump: 255,
      payees: [],
    });
    out.set(Keypair.generate().publicKey.toBase58(), Buffer.from(data).toString("base64"));
  }
  return out;
}

export async function newPage(browser: Browser, fake: Fake, width = 1280, root = ROOT): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript({ content: `${WALLET_SCRIPT}(${JSON.stringify(ADDRESS)});` });
  const profile = fake.band ? bandProfile("The Running Pigeons", "indie", fake.tour ? 1 : 0) : null;
  const shows = fake.tour ? await bookedShows(root) : new Map<string, string>();
  const { PublicKey } = await import("@solana/web3.js");
  const bandKey = PublicKey.findProgramAddressSync([Buffer.from("band"), new PublicKey(ADDRESS).toBuffer()], new PublicKey("4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8"))[0].toBase58();
  await page.route(/api\.devnet\.solana\.com/, async (route) => {
    const req = JSON.parse(route.request().postData() || "{}") as { id: number; method: string; params: unknown[] } | { id: number; method: string; params: unknown[] }[];
    const answer = (r: { method: string; params: unknown[] }) => {
      const ctx = { context: { slot: 1 } };
      const owner = "4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8";
      switch (r.method) {
        case "getAccountInfo": {
          // the band's profile, its shows; any other account (a fan's ticket) does not exist
          const key = r.params[0] as string;
          const data = shows.get(key) ?? (key === bandKey ? profile : null);
          return { ...ctx, value: data ? { data: [data, "base64"], executable: false, lamports: 2_000_000, owner, rentEpoch: 0, space: 100 } : null };
        }
        case "getMultipleAccounts":
          return { ...ctx, value: (r.params[0] as string[]).map((k) => ({ data: [shows.get(k) ?? "", "base64"], executable: false, lamports: 1, owner, rentEpoch: 0, space: 0 })) };
        case "getBalance":
          return { ...ctx, value: 1_500_000_000 };
        case "getProgramAccounts": {
          // only Show queries (discriminator filter at offset 0) get the booked shows; tickets: none
          const filters = ((r.params[1] as { filters?: { memcmp?: { offset: number; bytes: string } }[] } | undefined)?.filters ?? []).map((f) => f.memcmp).filter(Boolean);
          const disc = filters.find((f) => f!.offset === 0)?.bytes;
          if (disc && disc !== SHOW_DISC) return [];
          return [...shows].filter(([, data]) => Buffer.from(data, "base64").subarray(0, 8).equals(SHOW_DISC_BYTES)).map(([pubkey, data]) => ({ pubkey, account: { data: [data, "base64"], executable: false, lamports: 1, owner, rentEpoch: 0, space: 0 } }));
        }
        case "getSignaturesForAddress":
          return [];
        case "getLatestBlockhash":
          return { ...ctx, value: { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 100 } };
        case "getSlot":
          return 1;
        case "getBlockTime":
          return Math.floor(Date.now() / 1000);
        default:
          return null;
      }
    };
    if (fake.delay) await new Promise((r) => setTimeout(r, fake.delay));
    const body = Array.isArray(req) ? req.map((r) => ({ jsonrpc: "2.0", id: r.id, result: answer(r) })) : { jsonrpc: "2.0", id: req.id, result: answer(req) };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => undefined);
  });
  return page;
}

async function connect(page: Page): Promise<void> {
  // a wallet used earlier in this page reconnects by itself
  const signedIn = page.getByText("Signed in as");
  if (await signedIn.waitFor({ timeout: 3000 }).then(() => true, () => false)) return;
  await page.getByRole("button", { name: /connect wallet|select wallet/i }).first().click();
  await page.getByText("Test Wallet").first().click();
  await page.waitForTimeout(1200);
}

const JARGON = /\blamports?\b|\bbps\b|\bPDA\b|npm run|stack trace/i;
/** Values that leaked unformatted (case-sensitive so "Nantes" is fine). */
const BROKEN = /\bundefined\b|\bNaN\b|\[object Object\]|\bday 0\b/;

export async function runUiBot(root: string, opts: { build?: boolean; log?: (l: string) => void; shots?: string } = {}): Promise<UiCheck[]> {
  const log = opts.log ?? (() => undefined);
  const out = join(root, "packages/web/out");
  if (opts.build !== false) {
    log("building the static dashboard…");
    const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:static", "-w", "@greenroom/web"], {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
      env: { ...process.env, NEXT_PUBLIC_BASE_PATH: BASE, NEXT_PUBLIC_RPC_URL: "https://api.devnet.solana.com", NEXT_PUBLIC_CLUSTER: "devnet" },
    });
    if (r.status !== 0) return UI_CHECKS.map((c) => ({ ...c, ok: false, detail: `static build failed: ${(r.stdout + r.stderr).slice(-400)}` }));
  }
  const { chromium } = await import("playwright");
  const server = await serve(out);
  const url = (p: string) => `http://127.0.0.1:${(server.address() as AddressInfo).port}${BASE}${p}`;
  const browser = await chromium.launch(process.env.UI_BOT_CHROMIUM ? { executablePath: process.env.UI_BOT_CHROMIUM } : {});
  if (opts.shots) mkdirSync(opts.shots, { recursive: true });
  /** Screenshots for a human or model reviewer (--shots <dir>). */
  const shot = async (page: Page, name: string) => {
    if (opts.shots) await page.screenshot({ path: join(opts.shots, `${name}.png`), fullPage: true });
  };
  const results = new Map<string, { ok: boolean; detail: string }>();
  const check = async (id: string, fn: () => Promise<string | null>) => {
    try {
      const problem = await fn();
      results.set(id, { ok: problem === null, detail: problem ?? "ok" });
    } catch (e) {
      results.set(id, { ok: false, detail: `threw: ${(e as Error).message.split("\n")[0].slice(0, 300)}` });
    }
    log(`${results.get(id)!.ok ? "ok  " : "FAIL"} ${id}: ${results.get(id)!.detail}`);
  };

  try {
    await check("ux-public-first", async () => {
      const page = await newPage(browser, { band: true, delay: 0 });
      await page.goto(url("/"), { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ timeout: 5000 });
      const h1 = (await page.locator("h1").first().textContent()) ?? "";
      const connectBtn = await page.getByRole("button", { name: /connect wallet|select wallet/i }).filter({ visible: true }).count();
      const personal = await page.locator(".stats, .wallet-panel, .itinerary").count();
      const notice = await page.locator(".demo-notice").count();
      // the sign-up, when the build has an endpoint: the address goes out and the visitor is thanked
      let signup = "no form in this build";
      if (await page.locator(".demo-notice form").count()) {
        let posted = "";
        await page.route(/script\.google\.com|formspree|signup/, async (r) => {
          posted = r.request().postData() ?? "";
          await r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
        });
        await page.getByLabel("Your email").fill("fan@example.com");
        await page.getByRole("button", { name: /notify me/i }).click();
        const thanked = await page.getByText(/thanks/i).waitFor({ timeout: 5000 }).then(() => true, () => false);
        signup = thanked && posted.includes("fan%40example.com") ? "ok" : `sent "${posted}", thanked: ${thanked}`;
      }
      await shot(page, "1-public");
      await page.close();
      if (!connectBtn) return `no "Connect wallet" button on the first screen (h1: ${h1})`;
      if (connectBtn > 1) return `${connectBtn} connect buttons compete on the first screen`;
      if (personal) return `${personal} band-data blocks are visible before any wallet is connected`;
      if (!notice) return "no 'This is a demo version' notice";
      if (signup !== "ok" && signup !== "no form in this build") return `the email sign-up does not work: ${signup}`;
      return null;
    });

    await check("ux-connect-shows-mine", async () => {
      const page = await newPage(browser, { band: true, delay: 0 });
      await page.goto(url("/"), { waitUntil: "domcontentloaded" });
      await connect(page);
      await page.locator(".wallet-panel").waitFor({ timeout: 8000 });
      const panel = (await page.locator(".wallet-panel").textContent()) ?? "";
      const h1 = (await page.locator("h1").first().textContent()) ?? "";
      // innerText applies CSS text-transform: an upper-cased address is a different address
      const button = await page.locator(".wallet-adapter-button-trigger").first().innerText();
      await shot(page, "2-connected");
      await page.close();
      if (!panel.includes(ADDRESS.slice(0, 6))) return `the wallet panel does not show the connected address (${panel.slice(0, 80)})`;
      if (!/Running Pigeons/.test(h1)) return `the heading does not name the wallet's band (h1: ${h1})`;
      if (!button.includes(ADDRESS.slice(0, 4))) return `the wallet button changes the address's case ("${button}")`;
      return null;
    });

    await check("ux-next-step", async () => {
      const page = await newPage(browser, { band: true, delay: 0 });
      await page.goto(url("/"), { waitUntil: "domcontentloaded" });
      await connect(page);
      const cta = page.getByRole("link", { name: /create your first tour/i });
      await cta.first().waitFor({ timeout: 8000 });
      const primaries = await page.locator(".btn.primary:visible").count();
      await page.close();
      return primaries > 2 ? `${primaries} primary buttons compete for attention on the empty dashboard` : null;
    });

    await check("ux-create-tour", async () => {
      const page = await newPage(browser, { band: true, delay: 0 });
      await page.goto(url("/"), { waitUntil: "domcontentloaded" });
      await connect(page);
      await page.getByRole("link", { name: /create your first tour/i }).last().click();
      await page.locator("section.question").first().waitFor({ timeout: 8000 });
      const questions = await page.locator("section.question").count();
      const primaries = await page.locator(".btn.primary:visible").count();
      await shot(page, "3-questions");
      await page.getByRole("button", { name: "1,000" }).click();
      await page.getByRole("button", { name: "€30" }).click();
      await page.getByRole("button", { name: /^14 days/ }).click();
      await page.getByRole("button", { name: /plan my tour/i }).click();
      await page.getByRole("button", { name: /book this tour/i }).waitFor({ timeout: 20_000 });
      const stops = await page.locator(".itinerary .stop").count();
      const money = await page.locator(".money").count();
      const homeLine = (await page.locator("#your-route").textContent())?.includes("Home from") ?? false;
      await shot(page, "4-route-preview");
      // the band can rearrange the route: move the second stop later and see the comparison
      const before = (await page.locator(".itinerary .stop .city").allTextContents()).join(" → ");
      await page.getByRole("button", { name: /later$/ }).nth(1).click();
      const after = (await page.locator(".itinerary .stop .city").allTextContents()).join(" → ");
      const compared = (await page.locator("#your-route").textContent())?.includes("Your order") ?? false;
      // Book: the tour is packed into transactions and handed to the wallet (the test wallet refuses to sign)
      await page.getByRole("button", { name: /book this tour/i }).click();
      const bookError = await page
        .locator("p.bad")
        .first()
        .textContent({ timeout: 15_000 })
        .catch(() => "no answer");
      await page.close();
      if (questions !== 4) return `${questions} questions instead of 4`;
      if (primaries !== 1) return `${primaries} primary buttons on the questions step (want exactly one: Plan my tour)`;
      if (stops < 2) return `the route preview shows ${stops} stops`;
      if (!money) return "the route preview does not say what the tour earns or risks";
      if (!homeLine) return "the route preview does not say how far the last stop is from home";
      if (before === after || !compared) return `moving a stop does not change the route or compare it (${before} / ${after})`;
      if (!/cannot sign|cancelled/i.test(bookError ?? "")) return `booking did not reach the wallet: ${bookError}`;
      return null;
    });

    await check("ux-booked-tour", async () => {
      const page = await newPage(browser, { band: true, tour: true, delay: 0 });
      await page.goto(url("/"), { waitUntil: "domcontentloaded" });
      await connect(page);
      await page.locator(".itinerary .stop").first().waitFor({ timeout: 10_000 });
      await page.waitForTimeout(1500);
      const main = (await page.locator("main").textContent()) ?? "";
      await shot(page, "7-booked-dashboard");
      // the band's own show page: its city, and what it means for the band (not a fan's buy box)
      await page.locator(".itinerary a", { hasText: "Berlin" }).first().click();
      await page.locator("h1").first().waitFor({ timeout: 8000 });
      await page.waitForTimeout(2000);
      const showH1 = (await page.locator("h1").first().textContent()) ?? "";
      const showText = (await page.locator("main").textContent()) ?? "";
      await shot(page, "8-own-show");
      await page.goto(url("/feed/"), { waitUntil: "domcontentloaded" });
      await connect(page);
      await page.waitForTimeout(1500);
      const feed = (await page.locator("main").textContent()) ?? "";
      await page.close();
      const days = [...main.matchAll(/Day (\d+)/g)].map((m) => Number(m[1]));
      if (!days.includes(1) || !days.includes(3) || !days.includes(6)) return `planned days 1, 3, 6 not shown (saw ${[...new Set(days)].join(", ") || "none"})`;
      if (days.some((d) => d > 31)) return `impossible day numbers: ${days.filter((d) => d > 31).slice(0, 3).join(", ")}`;
      if (!/booked by you/.test(main)) return "the band's own tour is not labelled as booked by the band";
      if (/auto-pilot|Recorded run/i.test(main)) return "the band's own tour is labelled as auto-pilot or a recording";
      if (!/wait for their venue/.test(main)) return "nothing says the Leipzig show is waiting for its venue";
      if (/demo band/i.test(feed)) return "Activity shows the demo band to a connected band";
      if (!/Fans so far/.test(main) || !/€\d/.test(main)) return "the band's own tour is not shown in fans and euros";
      if (!/Berlin/.test(showH1)) return `the band's own show page does not name its city (h1: ${showH1})`;
      if (!/Your show/.test(showText) || /Buy \d/.test(showText)) return "the band's own show page shows a fan's buy box instead of what the show means for the band";
      // the same dashboard at phone width
      const phone = await newPage(browser, { band: true, tour: true, delay: 0 }, 390);
      await phone.goto(url("/"), { waitUntil: "domcontentloaded" });
      await connect(phone);
      await phone.locator(".itinerary .stop").first().waitFor({ timeout: 10_000 });
      const over = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await shot(phone, "phone-booked-dashboard");
      await phone.close();
      if (over > 1) return `the booked dashboard scrolls sideways on a phone (+${over}px)`;
      return null;
    });

    await check("ux-fast-paint", async () => {
      const slow: string[] = [];
      for (const p of PAGES) {
        const page = await newPage(browser, { band: true, delay: 4000 });
        const t0 = Date.now();
        await page.goto(url(p), { waitUntil: "domcontentloaded" });
        await page.locator("h1").first().waitFor({ timeout: 10_000 });
        const ms = Date.now() - t0;
        if (ms > 1500) slow.push(`${p} ${ms} ms`);
        await page.close();
      }
      return slow.length ? `slow first heading: ${slow.join(", ")}` : null;
    });

    await check("ux-phone-width", async () => {
      const wide: string[] = [];
      for (const p of PAGES) {
        // a connected band with a booked tour: the pages a band actually uses on a phone
        const page = await newPage(browser, { band: true, tour: true, delay: 0 }, 390);
        await page.goto(url(p), { waitUntil: "domcontentloaded" });
        await connect(page);
        await page.waitForTimeout(1500);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await shot(page, `phone${p.replace(/\//g, "-").replace(/-$/, "") || "-home"}`);
        if (over > 1) wide.push(`${p} +${over}px`);
        await page.close();
      }
      return wide.length ? `pages scroll sideways: ${wide.join(", ")}` : null;
    });

    await check("ux-names", async () => {
      const missing: string[] = [];
      for (const p of PAGES) {
        const page = await newPage(browser, { band: true, delay: 0 });
        await page.goto(url(p), { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);
        const bad = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of Array.from(document.querySelectorAll("button, a[href], input, select, textarea"))) {
            const h = el as HTMLElement;
            if (h.offsetParent === null && h.tagName !== "INPUT") continue;
            const labelled = h.getAttribute("aria-label") || h.getAttribute("title") || (h.id && document.querySelector(`label[for="${h.id}"]`)) || h.closest("label");
            const text = (h.textContent ?? "").trim() || (h as HTMLInputElement).placeholder;
            if (!labelled && !text) out.push(`${h.tagName.toLowerCase()}.${h.className}`.slice(0, 60));
          }
          return out;
        });
        if (bad.length) missing.push(`${p}: ${bad.slice(0, 3).join(", ")}`);
        await page.close();
      }
      return missing.length ? `unnamed controls: ${missing.join(" | ")}` : null;
    });

    await check("ux-headings-nav", async () => {
      const problems: string[] = [];
      for (const p of PAGES) {
        const page = await newPage(browser, { band: true, delay: 0 });
        await page.goto(url(p), { waitUntil: "domcontentloaded" });
        await connect(page);
        await page.waitForTimeout(800);
        const h1s = await page.locator("h1:visible").count();
        const active = await page.locator(".nav a.active").count();
        if (h1s !== 1) problems.push(`${p}: ${h1s} main headings`);
        if (p !== "/tour/new/" && active !== 1) problems.push(`${p}: ${active} nav items marked current`);
        await page.close();
      }
      return problems.length ? problems.join("; ") : null;
    });

    await check("ux-plain-language", async () => {
      const found: string[] = [];
      for (const p of ["/", "/tour/new/", "/approvals/", "/feed/"]) {
        const page = await newPage(browser, { band: true, delay: 0 });
        await page.goto(url(p), { waitUntil: "domcontentloaded" });
        await connect(page);
        await page.waitForTimeout(1200);
        // textContent, not innerText: closed groups count too
        const text = (await page.locator("main").textContent()) ?? "";
        const m = JARGON.exec(text) ?? BROKEN.exec(text);
        if (m) found.push(`${p}: "${text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, " ")}"`);
        await page.close();
      }
      return found.length ? `jargon on band pages: ${found.join(" | ")}` : null;
    });

    await check("ux-shared-controls", async () => {
      const odd: string[] = [];
      for (const p of PAGES) {
        const page = await newPage(browser, { band: true, delay: 0 });
        await page.goto(url(p), { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1200);
        const bad = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button"))
            .filter((b) => !/(^|\s)(btn|chip|choice|icon-btn|link-btn|tile|wallet-adapter)/.test(b.className) && !b.closest(".wallet-adapter-modal, nextjs-portal"))
            .map((b) => `"${(b.textContent ?? "").trim().slice(0, 20)}" .${b.className || "(no class)"}`)
        );
        if (bad.length) odd.push(`${p}: ${bad.slice(0, 3).join(", ")}`);
        await page.close();
      }
      return odd.length ? `one-off buttons: ${odd.join(" | ")}` : null;
    });

    await check("ux-activity-grouped", async () => {
      // Activity is a band page: look at the demo band's
      const page = await newPage(browser, { band: false, delay: 0 });
      await page.goto(url("/"), { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /explore the demo band/i }).click();
      await page.goto(url("/feed/"), { waitUntil: "domcontentloaded" });
      await page.locator(".agent-feed .phase").first().waitFor({ timeout: 8000 });
      const phases = await page.locator(".agent-feed .phase").count();
      const visible = await page.locator(".agent-feed .msg:visible").count();
      const chips = await page.locator(".agent-feed [role=tab]").count();
      const named = await page.locator(".agent-feed .msg-head b").count();
      await shot(page, "5-agent-feed");
      await page.close();
      if (phases < 3) return `only ${phases} phases in the agent feed`;
      if (visible > 4 * phases + 2) return `${visible} messages show at first; each phase should start with its latest few`;
      if (named < visible) return "some messages do not say who is speaking";
      if (chips < 3) return "no way to filter by who is speaking";
      return null;
    });

    await check("ux-guest-path", async () => {
      const page = await newPage(browser, { band: false, delay: 0 });
      await page.goto(url("/"), { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /explore the demo band/i }).click();
      await page.locator(".stats, .card").first().waitFor({ timeout: 8000 });
      const h1 = (await page.locator("h1").first().textContent()) ?? "";
      await page.goto(url("/venues/"), { waitUntil: "domcontentloaded" });
      // country → city → rooms, one tap each
      const venues = await (async () => {
        await page.locator(".tile").first().waitFor({ timeout: 8000 });
        await page.locator(".tile", { hasText: "Germany" }).click();
        await page.locator(".tile", { hasText: "Berlin" }).click();
        await page.locator(".city-card").first().waitFor({ timeout: 8000 });
        await shot(page, "9-venues-city");
        return true;
      })().catch(() => false);
      await page.goto(url("/planner/"), { waitUntil: "domcontentloaded" });
      const planner = (await page.locator("h1").first().textContent()) ?? "";
      await shot(page, "6-planner");
      await page.close();
      if (/booked by agents/i.test(h1)) return "Explore the demo band did not open the demo";
      if (!venues) return "Venues does not lead from a country to a city to its rooms";
      if (!/route planner/i.test(planner)) return "the Route planner is not reachable without a wallet";
      return null;
    });
  } finally {
    await browser.close();
    server.close();
  }
  return UI_CHECKS.map((c) => ({ ...c, ...(results.get(c.id) ?? { ok: false, detail: "did not run" }) }));
}

// npx tsx qa/src/ui-bot.ts [--no-build] [--shots <dir>]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), "../../..");
  const at = process.argv.indexOf("--shots");
  const shots = at === -1 ? undefined : resolve(process.argv[at + 1] ?? "qa/reports/ui");
  const checks = await runUiBot(root, { build: !process.argv.includes("--no-build"), log: console.log, shots });
  const passed = checks.filter((c) => c.ok).length;
  console.log(`\nUI bot: ${passed}/${checks.length} checks pass (score ${(1 + (9 * passed) / checks.length).toFixed(1)}/10)`);
  process.exit(passed === checks.length ? 0 : 1);
}
