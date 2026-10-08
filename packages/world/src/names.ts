import type { CountryCode } from "./types.ts";

export const FIRST_NAMES: Record<CountryCode, string[]> = {
  DE: ["Lukas", "Jonas", "Leon", "Finn", "Mia", "Lena", "Hannah", "Anna", "Paul", "Max", "Laura", "Sophie", "Tim", "Felix", "Julia", "Nico", "Marie", "Jan", "Katrin", "Moritz", "Nele", "Till", "Greta", "Ben"],
  AT: ["Lukas", "Tobias", "Florian", "David", "Anna", "Lena", "Sarah", "Julia", "Jakob", "Fabian", "Laura", "Lisa", "Simon", "Elias", "Magdalena", "Maximilian", "Sophie", "Matthias", "Katharina", "Paul", "Valentina", "Niklas", "Leonie", "Johanna"],
  FR: ["Lucas", "Hugo", "Louis", "Gabriel", "Emma", "Léa", "Chloé", "Manon", "Jules", "Arthur", "Camille", "Inès", "Théo", "Nathan", "Zoé", "Maxime", "Louise", "Enzo", "Clara", "Raphaël", "Sarah", "Adam", "Juliette", "Mathis"],
  PL: ["Jakub", "Kacper", "Mateusz", "Szymon", "Zuzanna", "Julia", "Maja", "Oliwia", "Filip", "Michał", "Natalia", "Wiktoria", "Bartek", "Kamil", "Aleksandra", "Piotr", "Marta", "Tomasz", "Karolina", "Adam", "Agnieszka", "Paweł", "Magda", "Wojtek"],
  CZ: ["Jan", "Jakub", "Tomáš", "Adam", "Tereza", "Eliška", "Anna", "Adéla", "Matěj", "Vojtěch", "Natálie", "Karolína", "Lukáš", "Ondřej", "Kristýna", "Filip", "Klára", "David", "Barbora", "Martin", "Veronika", "Petr", "Lucie", "Marek"],
};

export const LAST_NAMES: Record<CountryCode, string[]> = {
  DE: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hartmann", "Lange", "Werner", "Krause", "Lehmann"],
  AT: ["Gruber", "Huber", "Bauer", "Wagner", "Müller", "Pichler", "Steiner", "Moser", "Mayer", "Hofer", "Leitner", "Berger", "Fuchs", "Eder", "Fischer", "Schmid", "Winkler", "Weber", "Schwarz", "Maier", "Schneider", "Reiter", "Mayr", "Wimmer"],
  FR: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier"],
  PL: ["Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Wojciechowski", "Kwiatkowski", "Krawczyk", "Kaczmarek", "Piotrowski", "Grabowski", "Zając", "Pawłowski", "Michalski", "Król"],
  CZ: ["Novák", "Svoboda", "Novotný", "Dvořák", "Černý", "Procházka", "Kučera", "Veselý", "Horák", "Němec", "Marek", "Pospíšil", "Pokorný", "Hájek", "Král", "Jelínek", "Růžička", "Beneš", "Fiala", "Sedláček", "Doležal", "Zeman", "Kolář", "Navrátil"],
};

/** Word banks for invented band names. Combinations are checked for uniqueness. */
export const BAND_ADJ = [
  "Static", "Velvet", "Hollow", "Neon", "Paper", "Iron", "Glass", "Silent", "Golden", "Broken",
  "Electric", "Midnight", "Northern", "Lunar", "Crimson", "Wild", "Little", "Burning", "Frozen", "Secret",
  "Rusty", "Pale", "Loud", "Lost", "Royal", "Sunken", "Copper", "Hungry", "Nervous", "Plastic",
];
export const BAND_NOUN = [
  "Orchards", "Harbour", "Foxes", "Machines", "Wolves", "Sisters", "Engines", "Lanterns", "Rivers", "Mirrors",
  "Parade", "Signal", "Cinema", "Tigers", "Gardens", "Kites", "Pilots", "Horizon", "Tides", "Satellites",
  "Comets", "Arcade", "Bridges", "Hounds", "Saints", "Letters", "Islands", "Motors", "Ghosts", "Wires",
];
export const BAND_PATTERNS = [
  (a: string, n: string) => `The ${a} ${n}`,
  (a: string, n: string) => `${a} ${n}`,
  (a: string, n: string) => `${n} of ${a} Street`,
  (a: string, n: string) => `${a} ${n} Club`,
  (a: string, n: string) => `${n} & ${a}`,
];

/** Word-bank combinations that happen to be real acts; the generator skips them. */
export const REAL_BAND_BLOCKLIST = new Set(
  [
    "The Paper Kites", "Little Comets", "Wild Rivers", "Secret Machines", "Pale Saints", "Neon Horizon",
    "Electric Wolves", "Iron Wolves", "Broken Mirrors", "Velvet Sisters", "Hollow Hounds", "Royal Foxes",
    "Glass Tides", "Northern Lanterns", "Golden Gardens", "Crimson Comets", "Silent Machines", "Hungry Ghosts", "Lost Horizon",
    "Electric Six", "Glass Animals", "Neon Trees", "Iron Maiden", "Broken Social Scene",
  ].map((n) => n.toLowerCase())
);
