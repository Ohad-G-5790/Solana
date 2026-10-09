import * as anchor from "@anchor-lang/core";
import type { Idl, IdlAccounts, Wallet } from "@anchor-lang/core";
import BN from "bn.js";

// @anchor-lang/core is CommonJS; under Node 22's ESM loader its re-exported
// `BN` is neither a named export nor on the namespace object, so BN comes
// straight from bn.js (the same class Anchor re-exports).
const { AnchorProvider, Program } = anchor;
type AnchorProvider = anchor.AnchorProvider;
type Program<T extends Idl> = anchor.Program<T>;
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  type Commitment,
  type ConfirmOptions,
} from "@solana/web3.js";

import type { Greenroom } from "../idl/greenroom.ts";
import idlJson from "../idl/greenroom.json" with { type: "json" };
import { bandPda, showPda, ticketPda, tourPda, vaultPda, venuePda } from "./pdas.ts";

export type ShowAccount = IdlAccounts<Greenroom>["show"];
export type BandAccount = IdlAccounts<Greenroom>["bandProfile"];
export type VenueAccount = IdlAccounts<Greenroom>["venueProfile"];
export type TourAccount = IdlAccounts<Greenroom>["tour"];
export type TicketAccount = IdlAccounts<Greenroom>["ticket"];

export type ShowStateName = "proposed" | "onSale" | "confirmed" | "cancelled" | "settled";

export function showStateName(state: ShowAccount["state"]): ShowStateName {
  return Object.keys(state)[0] as ShowStateName;
}

export interface ProposeShowParams {
  date: number;
  ticketPriceLamports: number | bigint;
  capacity: number;
  thresholdBps: number;
  thresholdDeadline: number;
  bandBps: number;
  venueBps: number;
}

/** Minimal wallet adapter for a Keypair (Anchor's NodeWallet lives in a sub-path we avoid). */
export class KeypairWallet implements Wallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([this.payer]);
    else tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    for (const tx of txs) await this.signTransaction(tx);
    return txs;
  }
}

/**
 * Thin client over the Anchor program. One client = one fee payer (the
 * provider wallet). Authorities sign as extra signers, so a hub wallet can pay
 * fees for many agents while each agent keeps its own keys.
 */
export class GreenroomClient {
  readonly program: Program<Greenroom>;
  readonly provider: AnchorProvider;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = new Program(idlJson as Idl as Greenroom, provider);
  }

  static fromKeypair(connection: Connection, payer: Keypair, opts?: ConfirmOptions): GreenroomClient {
    const provider = new AnchorProvider(connection, new KeypairWallet(payer), {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
      ...opts,
    });
    return new GreenroomClient(provider);
  }

  get connection(): Connection {
    return this.provider.connection;
  }
  get programId(): PublicKey {
    return this.program.programId;
  }
  get payer(): PublicKey {
    return this.provider.wallet.publicKey;
  }

  // ---------- funding helpers ----------

  async airdrop(to: PublicKey, sol: number, commitment: Commitment = "confirmed"): Promise<string> {
    const sig = await this.connection.requestAirdrop(to, Math.round(sol * LAMPORTS_PER_SOL));
    const bh = await this.connection.getLatestBlockhash(commitment);
    await this.connection.confirmTransaction({ signature: sig, ...bh }, commitment);
    return sig;
  }

  /** Many transfers from one payer in as few transactions as possible (16 per tx). */
  async transferSolMany(from: Keypair, targets: { to: PublicKey; sol: number }[]): Promise<string[]> {
    const sigs: string[] = [];
    for (let i = 0; i < targets.length; i += 16) {
      const tx = new Transaction();
      for (const t of targets.slice(i, i + 16)) {
        tx.add(SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: t.to, lamports: Math.round(t.sol * LAMPORTS_PER_SOL) }));
      }
      sigs.push(await this.provider.sendAndConfirm(tx, [from]));
    }
    return sigs;
  }

  async transferSol(from: Keypair, to: PublicKey, sol: number): Promise<string> {
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) })
    );
    return this.provider.sendAndConfirm(tx, [from]);
  }

  // ---------- profiles ----------

  async registerBand(authority: Keypair, name: string, genre: string): Promise<{ sig: string; bandProfile: PublicKey }> {
    const bandProfile = bandPda(authority.publicKey, this.programId);
    const sig = await this.program.methods
      .registerBand(name, genre)
      .accountsPartial({ authority: authority.publicKey, bandProfile, systemProgram: SystemProgram.programId })
      .signers([authority])
      .rpc();
    return { sig, bandProfile };
  }

  async registerVenue(
    authority: Keypair,
    name: string,
    city: string,
    lat: number,
    lng: number,
    capacity: number
  ): Promise<{ sig: string; venueProfile: PublicKey }> {
    const venueProfile = venuePda(authority.publicKey, this.programId);
    const sig = await this.program.methods
      .registerVenue(name, city, Math.round(lat * 1e6), Math.round(lng * 1e6), capacity)
      .accountsPartial({ authority: authority.publicKey, venueProfile, systemProgram: SystemProgram.programId })
      .signers([authority])
      .rpc();
    return { sig, venueProfile };
  }

  // ---------- tour and shows ----------

  async createTour(
    bandAuthority: Keypair,
    tourId: number,
    name: string,
    region: string,
    startsAt: number,
    endsAt: number
  ): Promise<{ sig: string; tour: PublicKey }> {
    const bandProfile = bandPda(bandAuthority.publicKey, this.programId);
    const tour = tourPda(bandProfile, tourId, this.programId);
    const sig = await this.program.methods
      .createTour(tourId, name, region, new BN(startsAt), new BN(endsAt))
      .accountsPartial({ bandAuthority: bandAuthority.publicKey, bandProfile, tour, systemProgram: SystemProgram.programId })
      .signers([bandAuthority])
      .rpc();
    return { sig, tour };
  }

  async proposeShow(
    bandAuthority: Keypair,
    tour: PublicKey,
    venueProfile: PublicKey,
    p: ProposeShowParams
  ): Promise<{ sig: string; show: PublicKey }> {
    const bandProfile = bandPda(bandAuthority.publicKey, this.programId);
    const show = showPda(tour, venueProfile, p.date, this.programId);
    const sig = await this.program.methods
      .proposeShow(
        new BN(p.date),
        new BN(p.ticketPriceLamports.toString()),
        p.capacity,
        p.thresholdBps,
        new BN(p.thresholdDeadline),
        p.bandBps,
        p.venueBps
      )
      .accountsPartial({
        bandAuthority: bandAuthority.publicKey,
        bandProfile,
        tour,
        venueProfile,
        show,
        vault: vaultPda(show, this.programId),
        systemProgram: SystemProgram.programId,
      })
      .signers([bandAuthority])
      .rpc();
    return { sig, show };
  }

  async acceptShow(venueAuthority: Keypair, show: PublicKey): Promise<string> {
    return this.program.methods
      .acceptShow()
      .accountsPartial({ venueAuthority: venueAuthority.publicKey, show })
      .signers([venueAuthority])
      .rpc();
  }

  async rejectShow(venueAuthority: Keypair, show: PublicKey, bandAuthority: PublicKey): Promise<string> {
    return this.program.methods
      .rejectShow()
      .accountsPartial({
        venueAuthority: venueAuthority.publicKey,
        bandAuthority,
        show,
        vault: vaultPda(show, this.programId),
        systemProgram: SystemProgram.programId,
      })
      .signers([venueAuthority])
      .rpc();
  }

  async buyTicket(
    payer: Keypair | null,
    show: PublicKey,
    quantity: number,
    beneficiary: PublicKey
  ): Promise<{ sig: string; ticket: PublicKey }> {
    const ticket = ticketPda(show, beneficiary, this.programId);
    const payerKey = payer?.publicKey ?? this.payer;
    const builder = this.program.methods
      .buyTicket(quantity, beneficiary)
      .accountsPartial({ payer: payerKey, show, vault: vaultPda(show, this.programId), ticket, systemProgram: SystemProgram.programId });
    const sig = payer ? await builder.signers([payer]).rpc() : await builder.rpc();
    return { sig, ticket };
  }

  async checkThreshold(show: PublicKey): Promise<string> {
    return this.program.methods.checkThreshold().accountsPartial({ show }).rpc();
  }

  async refundTicket(show: PublicKey, buyer: PublicKey): Promise<string> {
    return this.program.methods
      .refundTicket()
      .accountsPartial({
        show,
        vault: vaultPda(show, this.programId),
        ticket: ticketPda(show, buyer, this.programId),
        buyer,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async settleShow(show: PublicKey, showAccount?: ShowAccount): Promise<string> {
    const s = showAccount ?? (await this.fetchShow(show));
    return this.program.methods
      .settleShow()
      .accountsPartial({
        show,
        bandProfile: s.bandProfile,
        venueProfile: s.venueProfile,
        bandAuthority: s.bandAuthority,
        venueAuthority: s.venueAuthority,
        vault: vaultPda(show, this.programId),
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(s.payees.map((p) => ({ pubkey: p.address, isSigner: false, isWritable: true })))
      .rpc();
  }

  async addPayee(bandAuthority: Keypair, show: PublicKey, address: PublicKey, bps: number, label: string): Promise<string> {
    return this.program.methods
      .addPayee(address, bps, label)
      .accountsPartial({ bandAuthority: bandAuthority.publicKey, show })
      .signers([bandAuthority])
      .rpc();
  }

  // ---------- reads ----------

  fetchShow(show: PublicKey): Promise<ShowAccount> {
    return this.program.account.show.fetch(show);
  }
  fetchBand(bandProfile: PublicKey): Promise<BandAccount> {
    return this.program.account.bandProfile.fetch(bandProfile);
  }
  fetchBandByAuthority(authority: PublicKey): Promise<BandAccount> {
    return this.fetchBand(bandPda(authority, this.programId));
  }
  fetchVenue(venueProfile: PublicKey): Promise<VenueAccount> {
    return this.program.account.venueProfile.fetch(venueProfile);
  }
  fetchTour(tour: PublicKey): Promise<TourAccount> {
    return this.program.account.tour.fetch(tour);
  }
  async fetchTicketOrNull(show: PublicKey, buyer: PublicKey): Promise<TicketAccount | null> {
    return this.program.account.ticket.fetchNullable(ticketPda(show, buyer, this.programId));
  }

  /** All shows of a tour (memcmp on the `tour` field right after the discriminator). */
  async listShowsByTour(tour: PublicKey): Promise<{ publicKey: PublicKey; account: ShowAccount }[]> {
    return this.program.account.show.all([{ memcmp: { offset: 8, bytes: tour.toBase58() } }]);
  }
  /** All tickets of a show (memcmp on the `show` field). */
  async listTicketsByShow(show: PublicKey): Promise<{ publicKey: PublicKey; account: TicketAccount }[]> {
    return this.program.account.ticket.all([{ memcmp: { offset: 8, bytes: show.toBase58() } }]);
  }
  async listVenues(): Promise<{ publicKey: PublicKey; account: VenueAccount }[]> {
    return this.program.account.venueProfile.all();
  }
  async listBands(): Promise<{ publicKey: PublicKey; account: BandAccount }[]> {
    return this.program.account.bandProfile.all();
  }

  async chainTime(): Promise<number> {
    const slot = await this.connection.getSlot("confirmed");
    const t = await this.connection.getBlockTime(slot);
    return t ?? Math.floor(Date.now() / 1000);
  }
}

export { BN, idlJson as GREENROOM_IDL };
