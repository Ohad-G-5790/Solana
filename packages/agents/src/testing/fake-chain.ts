/**
 * In-memory stand-in for the Greenroom program, for orchestrator tests that
 * cannot start a validator. It enforces the preconditions in
 * docs/01-program-spec.md (state machine, deadlines, capacity, splits) with a
 * clock that runs `speed` times faster than wall time. It is not a substitute
 * for tests/greenroom.ts, which runs the real program.
 */
import { Keypair, PublicKey } from "@solana/web3.js";
import { bandPda, PROGRAM_ID, showPda, ticketPda, tourPda, venuePda, type GreenroomClient, type ProposeShowParams, type ShowAccount, type TicketAccount } from "@greenroom/sdk";

type State = "proposed" | "onSale" | "confirmed" | "cancelled" | "settled";

interface Show {
  key: PublicKey;
  tour: PublicKey;
  bandProfile: PublicKey;
  venueProfile: PublicKey;
  bandAuthority: PublicKey;
  venueAuthority: PublicKey;
  date: number;
  ticketPriceLamports: number;
  capacity: number;
  thresholdBps: number;
  thresholdDeadline: number;
  bandBps: number;
  venueBps: number;
  payees: { address: PublicKey; bps: number; label: string }[];
  ticketsSold: number;
  ticketsRefunded: number;
  escrowLamports: number;
  state: State;
}

interface Ticket {
  key: PublicKey;
  show: PublicKey;
  buyer: PublicKey;
  quantity: number;
  amountLamports: number;
  refunded: boolean;
}

export class FakeChain {
  readonly programId = PROGRAM_ID;
  private readonly t0 = Math.floor(Date.now() / 1000);
  private readonly wall0 = Date.now();
  private sigs = 0;
  readonly venues = new Map<string, { authority: PublicKey; capacity: number }>();
  readonly tours = new Map<string, { band: PublicKey; startsAt: number; endsAt: number; shows: number }>();
  readonly shows = new Map<string, Show>();
  readonly tickets = new Map<string, Ticket>();
  private toursCreated = 0;
  /** Every instruction, in order: [name, show?]. */
  readonly calls: [string, string?][] = [];

  constructor(readonly speed = 10) {}

  /** The slice of Anchor's program the keeper reads: every show account. */
  get program() {
    // honours the keeper's state filter (memcmp on the state byte, base58 "1".."5" = Proposed..Settled)
    const order: State[] = ["proposed", "onSale", "confirmed", "cancelled", "settled"];
    return {
      account: {
        show: {
          all: async (filters: { memcmp: { offset: number; bytes: string } }[] = []) =>
            [...this.shows.values()]
              .filter((s) => filters.every((f) => f.memcmp.offset !== 218 || order[Number(f.memcmp.bytes) - 1] === s.state))
              .map((s) => ({ publicKey: s.key, account: this.view(s) })),
        },
      },
    };
  }

  /** The slice of a Connection the keeper uses. */
  get connection() {
    return {
      getBalance: async () => 100e9,
      getMultipleAccountsInfo: async (keys: PublicKey[]) => keys.map((k) => (this.venues.has(k.toBase58()) ? ({} as never) : null)),
    };
  }

  async transferSolMany() {
    return [this.sig("transferSolMany")];
  }

  async registerVenue(authority: Keypair, _name: string, _city: string, _lat: number, _lng: number, capacity: number) {
    const profile = venuePda(authority.publicKey, this.programId);
    this.registerVenue_(authority.publicKey, profile, capacity);
    return { sig: this.sig("registerVenue"), venueProfile: profile };
  }

  private view(s: Show): ShowAccount {
    return { ...s, state: { [s.state]: {} }, payees: [...s.payees] } as unknown as ShowAccount;
  }

  /** The fake typed as the client the agents expect. */
  get client(): GreenroomClient {
    return this as unknown as GreenroomClient;
  }

  now(): number {
    return this.t0 + Math.floor(((Date.now() - this.wall0) * this.speed) / 1000);
  }

  private sig(name: string, show?: PublicKey): string {
    this.calls.push([name, show?.toBase58()]);
    return `sig${++this.sigs}`;
  }

  private show(key: PublicKey): Show {
    const s = this.shows.get(key.toBase58());
    if (!s) throw new Error(`Account does not exist or has no data ${key.toBase58()}`);
    return s;
  }

  /** Put a venue on the fake chain directly (test setup). */
  registerVenue_(authority: PublicKey, profile: PublicKey, capacity: number): void {
    this.venues.set(profile.toBase58(), { authority, capacity });
  }

  // ---------- the client surface the agents use ----------

  async chainTime(): Promise<number> {
    return this.now();
  }

  async fetchBand(_profile: PublicKey) {
    return { name: "Fake Band", genre: "rock", showsCompleted: 0, ticketsSoldTotal: 0, grossSettledLamports: 0, toursCreated: this.toursCreated };
  }

  async createTour(band: Keypair, tourId: number, _name: string, _region: string, startsAt: number, endsAt: number) {
    if (tourId !== this.toursCreated) throw new Error("WrongTourId");
    if (startsAt >= endsAt) throw new Error("InvalidDates");
    const tour = tourPda(bandPda(band.publicKey, this.programId), tourId, this.programId);
    this.tours.set(tour.toBase58(), { band: band.publicKey, startsAt, endsAt, shows: 0 });
    this.toursCreated++;
    return { sig: this.sig("createTour"), tour };
  }

  async proposeShow(band: Keypair, tour: PublicKey, venueProfile: PublicKey, p: ProposeShowParams) {
    const t = this.tours.get(tour.toBase58());
    const v = this.venues.get(venueProfile.toBase58());
    if (!t || !t.band.equals(band.publicKey)) throw new Error("Unauthorized");
    if (!v) throw new Error("venue not registered");
    if (p.date < t.startsAt || p.date > t.endsAt || p.thresholdDeadline >= p.date) throw new Error("InvalidDates");
    if (p.thresholdBps <= 0 || p.thresholdBps > 10_000) throw new Error("InvalidThreshold");
    if (p.bandBps + p.venueBps !== 10_000) throw new Error("InvalidSplit");
    if (p.capacity <= 0 || p.capacity > v.capacity) throw new Error("CapacityExceedsVenue");
    if (Number(p.ticketPriceLamports) <= 0) throw new Error("InvalidPrice");
    const key = showPda(tour, venueProfile, p.date, this.programId);
    if (this.shows.has(key.toBase58())) throw new Error("already in use");
    this.shows.set(key.toBase58(), {
      key,
      tour,
      bandProfile: bandPda(band.publicKey, this.programId),
      venueProfile,
      bandAuthority: band.publicKey,
      venueAuthority: v.authority,
      date: p.date,
      ticketPriceLamports: Number(p.ticketPriceLamports),
      capacity: p.capacity,
      thresholdBps: p.thresholdBps,
      thresholdDeadline: p.thresholdDeadline,
      bandBps: p.bandBps,
      venueBps: p.venueBps,
      payees: [],
      ticketsSold: 0,
      ticketsRefunded: 0,
      escrowLamports: 0,
      state: "proposed",
    });
    t.shows++;
    return { sig: this.sig("proposeShow", key), show: key };
  }

  async acceptShow(venue: Keypair, key: PublicKey) {
    const s = this.show(key);
    if (!s.venueAuthority.equals(venue.publicKey)) throw new Error("Unauthorized");
    if (s.state !== "proposed") throw new Error("InvalidState");
    s.state = "onSale";
    return this.sig("acceptShow", key);
  }

  async rejectShow(venue: Keypair, key: PublicKey, _band: PublicKey) {
    const s = this.show(key);
    if (!s.venueAuthority.equals(venue.publicKey)) throw new Error("Unauthorized");
    if (s.state !== "proposed") throw new Error("InvalidState");
    this.shows.delete(key.toBase58());
    return this.sig("rejectShow", key);
  }

  async buyTicket(_payer: Keypair | null, key: PublicKey, quantity: number, beneficiary: PublicKey) {
    const s = this.show(key);
    const now = this.now();
    if (s.state !== "onSale" && s.state !== "confirmed") throw new Error("InvalidState");
    if (now >= s.date || (s.state === "onSale" && now >= s.thresholdDeadline)) throw new Error("SalesClosed");
    if (quantity < 1 || quantity > 10) throw new Error("InvalidQuantity");
    if (s.ticketsSold + quantity > s.capacity) throw new Error("SoldOut");
    const tk = ticketPda(key, beneficiary, this.programId);
    if (this.tickets.has(tk.toBase58())) throw new Error("already in use");
    const amount = quantity * s.ticketPriceLamports;
    this.tickets.set(tk.toBase58(), { key: tk, show: key, buyer: beneficiary, quantity, amountLamports: amount, refunded: false });
    s.ticketsSold += quantity;
    s.escrowLamports += amount;
    return { sig: this.sig("buyTicket", key), ticket: tk };
  }

  async checkThreshold(key: PublicKey) {
    const s = this.show(key);
    if (s.state !== "onSale") throw new Error("InvalidState");
    if (s.ticketsSold * 10_000 >= s.capacity * s.thresholdBps) s.state = "confirmed";
    else if (this.now() >= s.thresholdDeadline) s.state = "cancelled";
    else throw new Error("TooEarly");
    return this.sig("checkThreshold", key);
  }

  async refundTicket(key: PublicKey, buyer: PublicKey) {
    const s = this.show(key);
    if (s.state !== "cancelled") throw new Error("InvalidState");
    const tk = this.tickets.get(ticketPda(key, buyer, this.programId).toBase58());
    if (!tk || tk.refunded) throw new Error("AlreadyRefunded");
    tk.refunded = true;
    s.ticketsRefunded += tk.quantity;
    s.escrowLamports -= tk.amountLamports;
    this.tickets.delete(tk.key.toBase58()); // the program closes the ticket account
    return this.sig("refundTicket", key);
  }

  async settleShow(key: PublicKey) {
    const s = this.show(key);
    if (s.state !== "confirmed") throw new Error("InvalidState");
    if (this.now() < s.date) throw new Error("TooEarly");
    s.state = "settled";
    s.escrowLamports = 0;
    return this.sig("settleShow", key);
  }

  async addPayee(band: Keypair, key: PublicKey, address: PublicKey, bps: number, label: string) {
    const s = this.show(key);
    if (!s.bandAuthority.equals(band.publicKey)) throw new Error("Unauthorized");
    if (!["proposed", "onSale", "confirmed"].includes(s.state)) throw new Error("InvalidState");
    if (s.payees.length >= 4) throw new Error("TooManyPayees");
    if (bps >= s.bandBps) throw new Error("InvalidSplit");
    s.payees.push({ address, bps, label });
    s.bandBps -= bps;
    return this.sig("addPayee", key);
  }

  async fetchShow(key: PublicKey): Promise<ShowAccount> {
    return this.view(this.show(key));
  }

  async listTicketsByShow(key: PublicKey): Promise<{ publicKey: PublicKey; account: TicketAccount }[]> {
    return [...this.tickets.values()].filter((t) => t.show.equals(key)).map((t) => ({ publicKey: t.key, account: t as unknown as TicketAccount }));
  }
}
