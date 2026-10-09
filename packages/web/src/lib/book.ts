"use client";

import { toVenueOffer, venueOfferHeuristic } from "@greenroom/agents/offers";
import { planTour, type PlannedShow, type VenueOffer } from "@greenroom/agents/planner";
import type { City } from "@greenroom/world";
import { BN } from "@anchor-lang/core";
import { PublicKey, SystemProgram, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { bandPda, connection, vaultPda, walletProgram, type BandAccount, type WalletLike } from "./greenroom";
import type { WorldCity, WorldVenue } from "./run";
import { venueKeys } from "./venue-keys";

/** How many people the band can bring: the one number the venues care about most. */
export const DRAWS = [100, 200, 500, 1000, 2500, 5000];
export const LENGTHS = [7, 10, 14, 21, 30];
export const PRICES = [10, 15, 20, 30, 50];
export const COUNTRIES = ["DE", "AT", "FR", "PL", "CZ"];
/** Devnet play money: a euro of ticket price is 10,000 lamports, so simulated fans can afford whole tours. */
export const LAMPORTS_PER_EURO = 10_000;
/** On devnet each show sells a sample of the room (1 on-chain ticket per 20 people), at least 12 and at most 40. */
export const SAMPLE = 0.05;
const MIN_TICKETS = 12;
const MAX_TICKETS = 40;
/** Demo clock: sales run 40 minutes (the keeper visits every 10), the show is 30 minutes after the deadline. */
export const SALES_MINUTES = 40;
const SHOW_AFTER_DEADLINE_MIN = 30;

export interface TourAnswers {
  draw: number;
  priceEuro: number;
  startCity: string;
  days: number;
}

export interface TourPlan {
  answers: TourAnswers;
  offers: VenueOffer[];
  declined: number;
  plan: PlannedShow[];
}

/** Shows for a tour of `days` days: about two in three nights, with travel and rest days between. */
export const showsFor = (days: number) => Math.max(2, Math.min(15, Math.round((days * 2) / 3)));

/**
 * Ask every seed venue that is on-chain (the same rules its agent uses) and
 * plan the route with the band agent's planner. Nothing is sent anywhere.
 */
export async function planFromAnswers(a: TourAnswers, band: Pick<BandAccount, "genre" | "showsCompleted" | "ticketsSoldTotal">, world: { venues: WorldVenue[]; cities: WorldCity[] }): Promise<TourPlan> {
  const { byId } = await venueKeys();
  const candidates = world.venues.filter((v) => COUNTRIES.includes(v.country) && byId.has(v.id));
  // only venues whose profile exists on-chain can sign a show
  const profiles = candidates.map((v) => new PublicKey(byId.get(v.id)!.profile));
  const registered = new Set<string>();
  for (let i = 0; i < profiles.length; i += 100) {
    const infos = await connection.getMultipleAccountsInfo(profiles.slice(i, i + 100));
    infos.forEach((info, j) => info && registered.add(profiles[i + j].toBase58()));
  }
  const req = {
    genre: band.genre,
    draw: a.draw,
    targetPriceLamports: a.priceEuro * LAMPORTS_PER_EURO,
    trackRecord: { showsCompleted: band.showsCompleted, ticketsSoldTotal: Number(band.ticketsSoldTotal) },
  };
  const offers: VenueOffer[] = [];
  let declined = 0;
  for (const v of candidates) {
    const profile = byId.get(v.id)!.profile;
    if (!registered.has(profile)) continue;
    const d = venueOfferHeuristic(v as never, req);
    if (d.offer) offers.push(toVenueOffer(v as never, profile, d, a.days));
    else declined++;
  }
  const plan = planTour({
    band: { genre: band.genre as never, draw: a.draw, targetPriceLamports: req.targetPriceLamports, homeCity: a.startCity },
    offers,
    cities: world.cities as City[],
    wantedShows: showsFor(a.days),
    windowDays: a.days,
    startCity: a.startCity,
    thresholdBps: 5000,
    capacityScale: SAMPLE,
    minCapacity: MIN_TICKETS,
  }).map((p) => ({ ...p, capacity: Math.min(MAX_TICKETS, p.capacity) }));
  return { answers: a, offers, declined, plan };
}

const enc = (s: string) => Buffer.from(s);
// DataView, not Buffer: the browser's Buffer polyfill has no 64-bit writers.
const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return Buffer.from(b);
};
const i64 = (n: number) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, BigInt(n), true);
  return Buffer.from(b);
};

export interface BookedTour {
  tour: string;
  shows: string[];
  signatures: string[];
}

/**
 * Open the tour and propose every show, signed by the band's wallet in one
 * approval. Venues' agents sign their shows when the keeper next runs.
 */
export async function bookTour(wallet: WalletLike, band: BandAccount, p: TourPlan, onStatus: (s: string) => void): Promise<BookedTour> {
  const program = walletProgram(wallet);
  const programId = program.programId;
  const bandProfile = bandPda(wallet.publicKey);
  const fresh = await program.account.bandProfile.fetch(bandProfile);
  const tourId = fresh.toursCreated;
  const tour = PublicKey.findProgramAddressSync([enc("tour"), bandProfile.toBuffer(), u32(tourId)], programId)[0];
  const now = Math.floor(Date.now() / 1000);
  const ixs: TransactionInstruction[] = [];
  ixs.push(
    await program.methods
      .createTour(tourId, `${band.name} tour ${tourId + 1}`.slice(0, 32), "Central EU", new BN(now - 120), new BN(now + 8 * 3600))
      .accountsPartial({ bandAuthority: wallet.publicKey, bandProfile, tour, systemProgram: SystemProgram.programId })
      .instruction()
  );
  const shows: string[] = [];
  for (const [i, s] of p.plan.entries()) {
    const deadline = now + SALES_MINUTES * 60 + i * 180;
    const date = deadline + SHOW_AFTER_DEADLINE_MIN * 60;
    const venueProfile = new PublicKey(s.venuePubkey);
    const show = PublicKey.findProgramAddressSync([enc("show"), tour.toBuffer(), venueProfile.toBuffer(), i64(date)], programId)[0];
    shows.push(show.toBase58());
    ixs.push(
      await program.methods
        .proposeShow(new BN(date), new BN(s.ticketPriceLamports), s.capacity, s.thresholdBps, new BN(deadline), s.bandBps, s.venueBps)
        .accountsPartial({ bandAuthority: wallet.publicKey, bandProfile, tour, venueProfile, show, vault: vaultPda(show), systemProgram: SystemProgram.programId })
        .instruction()
    );
  }

  // Pack the instructions into as few transactions as fit (1232 bytes each), in order.
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const txs: Transaction[] = [];
  let cur = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight });
  for (const ix of ixs) {
    const trial = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(...cur.instructions, ix);
    const size = trial.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
    if (cur.instructions.length && size > 1232) {
      txs.push(cur);
      cur = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(ix);
    } else cur = trial;
  }
  txs.push(cur);

  onStatus(`Approve ${txs.length} transaction${txs.length > 1 ? "s" : ""} in your wallet…`);
  const signed = await wallet.signAllTransactions(txs);
  const signatures: string[] = [];
  for (const [i, tx] of signed.entries()) {
    onStatus(`Sending ${i + 1} of ${signed.length}…`);
    const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
    signatures.push(sig);
    // the tour must exist before the next batch proposes into it
    for (let t = 0; t < 60; t++) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = (await connection.getSignatureStatuses([sig])).value[0];
      if (st?.err) throw new Error(`Transaction ${i + 1} failed: ${JSON.stringify(st.err)}`);
      if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) break;
      if (t === 59) throw new Error(`Transaction ${i + 1} was not confirmed in 90 s; check the explorer for ${sig}`);
    }
  }
  return { tour: tour.toBase58(), shows, signatures };
}
