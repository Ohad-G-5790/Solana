export type CountryCode = "DE" | "AT" | "FR" | "PL" | "CZ";

export type Genre =
  | "rock"
  | "metal"
  | "punk"
  | "indie"
  | "electronic"
  | "hiphop"
  | "jazz"
  | "pop"
  | "folk";

export const GENRES: Genre[] = [
  "rock",
  "metal",
  "punk",
  "indie",
  "electronic",
  "hiphop",
  "jazz",
  "pop",
  "folk",
];

export interface City {
  name: string;
  country: CountryCode;
  lat: number;
  lng: number;
  population?: number;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: CountryCode;
  capacity: number;
  lat: number;
  lng: number;
  geo_precision?: "venue" | "city";
  genres: Genre[];
  website?: string;
  notes?: string;
  source?: string;
  /** 32-byte hex seed used to derive the venue agent's wallet deterministically. */
  seed: string;
}

export interface VenueFile {
  disclaimer: string;
  generated: string;
  cities: City[];
  venues: Omit<Venue, "seed">[];
}

export interface Band {
  id: string;
  name: string;
  genre: Genre;
  /** Home city name (one of the dataset cities). */
  homeCity: string;
  country: CountryCode;
  /** Typical audience the band draws in a city where it is known. */
  draw: number;
  /** Ticket price the band targets, in lamports. */
  targetPriceLamports: number;
  /** How many shows the band played last year (used to seed on-chain history). */
  lastYearShows: number;
  /** Tickets sold last year in total. */
  lastYearTickets: number;
  seed: string;
}

export type CrewRole =
  | "sound engineer"
  | "lighting tech"
  | "photographer"
  | "videographer"
  | "tour driver"
  | "merch seller"
  | "stage manager"
  | "session guitarist"
  | "session keys"
  | "session drummer"
  | "pyro tech"
  | "backline tech";

export const CREW_ROLES: CrewRole[] = [
  "sound engineer",
  "lighting tech",
  "photographer",
  "videographer",
  "tour driver",
  "merch seller",
  "stage manager",
  "session guitarist",
  "session keys",
  "session drummer",
  "pyro tech",
  "backline tech",
];

export interface CrewProfile {
  id: string;
  name: string;
  role: CrewRole;
  city: string;
  country: CountryCode;
  /** Share of a show's revenue the crew member asks for, in basis points. */
  askBps: number;
  /** 1.0 to 5.0 */
  rating: number;
  yearsExperience: number;
  genres: Genre[];
  seed: string;
}

export interface FanProfile {
  id: string;
  name: string;
  city: string;
  country: CountryCode;
  /** Preference weight per genre, 0..1 */
  taste: Partial<Record<Genre, number>>;
  /** Max ticket price the fan accepts, in lamports. */
  maxPriceLamports: number;
  /** How eager the fan is to buy early (0..1). */
  eagerness: number;
  seed: string;
}

export interface World {
  cities: City[];
  venues: Venue[];
  bands: Band[];
  crew: CrewProfile[];
  fans: FanProfile[];
}
