import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Rng } from "./rng.ts";
import { BAND_ADJ, BAND_NOUN, BAND_PATTERNS, FIRST_NAMES, LAST_NAMES, REAL_BAND_BLOCKLIST } from "./names.ts";
import {
  CREW_ROLES,
  GENRES,
  type Band,
  type City,
  type CountryCode,
  type CrewProfile,
  type FanProfile,
  type Genre,
  type Venue,
  type VenueFile,
  type World,
} from "./types.ts";

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface GenerateOptions {
  /** Master seed; the same seed always yields the same world. */
  seed?: string;
  bands?: number;
  crewPerCity?: number;
  fansPerCity?: number;
  /** Path to venues.json; defaults to <repo>/data/venues.json */
  venuesPath?: string;
  /** Ticket price scale: demo uses tiny prices so devnet SOL goes far. */
  basePriceLamports?: number;
}

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VENUES_PATH = resolve(here, "../../../data/venues.json");

export function loadVenueFile(path = DEFAULT_VENUES_PATH): VenueFile {
  const raw = JSON.parse(readFileSync(path, "utf8")) as VenueFile;
  if (!Array.isArray(raw.venues) || !Array.isArray(raw.cities)) {
    throw new Error(`venues.json at ${path} is missing "venues" or "cities"`);
  }
  return raw;
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateBands(rng: Rng, cities: City[], count: number, basePrice: number): Band[] {
  const used = new Set<string>();
  const bands: Band[] = [];
  let guard = 0;
  while (bands.length < count && guard++ < count * 50) {
    const adj = rng.pick(BAND_ADJ);
    const noun = rng.pick(BAND_NOUN);
    const name = rng.pick(BAND_PATTERNS)(adj, noun);
    if (used.has(name) || name.length > 32 || REAL_BAND_BLOCKLIST.has(name.toLowerCase())) continue;
    used.add(name);
    const city = rng.pick(cities);
    const genre = rng.pick(GENRES);
    const draw = Math.round(rng.gauss(450, 350, 120, 2500));
    const lastYearShows = rng.int(0, 24);
    const avgSold = Math.round(draw * rng.gauss(0.7, 0.2, 0.3, 1.0));
    bands.push({
      id: slug(name),
      name,
      genre,
      homeCity: city.name,
      country: city.country,
      draw,
      targetPriceLamports: Math.round(basePrice * rng.gauss(1.0, 0.35, 0.4, 2.5)),
      lastYearShows,
      lastYearTickets: lastYearShows * avgSold,
      seed: rng.seedHex(`band:${name}`),
    });
  }
  return bands;
}

function personName(rng: Rng, country: CountryCode): string {
  return `${rng.pick(FIRST_NAMES[country])} ${rng.pick(LAST_NAMES[country])}`;
}

export function generateCrew(rng: Rng, cities: City[], perCity: number): CrewProfile[] {
  const out: CrewProfile[] = [];
  for (const city of cities) {
    const used = new Set<string>();
    for (let i = 0; i < perCity; i++) {
      let name = personName(rng, city.country);
      let guard = 0;
      while (used.has(name) && guard++ < 20) name = personName(rng, city.country);
      used.add(name);
      const role = rng.pick(CREW_ROLES);
      const years = rng.int(1, 25);
      out.push({
        id: `${slug(city.name)}-crew-${i + 1}`,
        name,
        role,
        city: city.name,
        country: city.country,
        askBps: rng.int(100, 800),
        rating: Math.round(rng.gauss(4.0, 0.6, 2.5, 5.0) * 10) / 10,
        yearsExperience: years,
        genres: rng.sample(GENRES, rng.int(1, 3)),
        seed: rng.seedHex(`crew:${city.name}:${i}`),
      });
    }
  }
  return out;
}

/** Fans per city: `base` scaled by the square root of population in millions, clamped to 0.35..2. */
export function fansForCity(city: City, base: number): number {
  const pop = city.population ?? 500_000;
  const k = Math.min(2, Math.max(0.35, Math.sqrt(pop / 1_000_000)));
  return Math.max(8, Math.round(base * k));
}

export function generateFans(rng: Rng, cities: City[], perCity: number, basePrice: number): FanProfile[] {
  const out: FanProfile[] = [];
  for (const city of cities) {
    const n = fansForCity(city, perCity);
    for (let i = 0; i < n; i++) {
      const favourites = rng.sample(GENRES, rng.int(1, 3));
      const taste: Partial<Record<Genre, number>> = {};
      for (const g of favourites) taste[g] = Math.round(rng.gauss(0.75, 0.2, 0.3, 1) * 100) / 100;
      out.push({
        id: `${slug(city.name)}-fan-${i + 1}`,
        name: personName(rng, city.country),
        city: city.name,
        country: city.country,
        taste,
        maxPriceLamports: Math.round(basePrice * rng.gauss(1.3, 0.5, 0.5, 3)),
        eagerness: Math.round(rng.gauss(0.5, 0.25, 0.05, 1) * 100) / 100,
        seed: rng.seedHex(`fan:${city.name}:${i}`),
      });
    }
  }
  return out;
}

export function generateWorld(opts: GenerateOptions = {}): World {
  const seed = opts.seed ?? "greenroom-2026";
  const rng = new Rng(seed);
  const file = loadVenueFile(opts.venuesPath);
  const basePrice = opts.basePriceLamports ?? 0.01 * LAMPORTS_PER_SOL;

  const cities = file.cities;
  const venues: Venue[] = file.venues.map((v) => ({
    ...v,
    seed: rng.seedHex(`venue:${v.id}`),
  }));
  const bands = generateBands(rng, cities, opts.bands ?? 100, basePrice);
  const crew = generateCrew(rng, cities, opts.crewPerCity ?? 100);
  const fans = generateFans(rng, cities, opts.fansPerCity ?? 200, basePrice);
  return { cities, venues, bands, crew, fans };
}

/** Great-circle distance in km between two coordinates. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
