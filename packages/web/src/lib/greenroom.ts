"use client";

import { AnchorProvider, Program, type Idl, type IdlAccounts, type Wallet } from "@anchor-lang/core";
import { Connection, PublicKey, SystemProgram, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import type { Greenroom } from "@/idl/greenroom";
import idl from "@/idl/greenroom.json";
import { PROGRAM_ID, RPC_URL } from "./config";
import { politeFetch } from "./rpc";

export type ShowAccount = IdlAccounts<Greenroom>["show"];
export type BandAccount = IdlAccounts<Greenroom>["bandProfile"];
export type VenueAccount = IdlAccounts<Greenroom>["venueProfile"];
export type TicketAccount = IdlAccounts<Greenroom>["ticket"];
export type TourAccount = IdlAccounts<Greenroom>["tour"];
export type ShowStateName = "proposed" | "onSale" | "confirmed" | "cancelled" | "settled";

export const programId = new PublicKey(PROGRAM_ID);
export const connection = new Connection(RPC_URL, { commitment: "confirmed", fetch: politeFetch, disableRetryOnRateLimit: true });

export function stateName(state: ShowAccount["state"]): ShowStateName {
  return Object.keys(state)[0] as ShowStateName;
}

const enc = (s: string) => Buffer.from(s);
export const vaultPda = (show: PublicKey) => PublicKey.findProgramAddressSync([enc("vault"), show.toBuffer()], programId)[0];
export const ticketPda = (show: PublicKey, buyer: PublicKey) =>
  PublicKey.findProgramAddressSync([enc("ticket"), show.toBuffer(), buyer.toBuffer()], programId)[0];
export const bandPda = (authority: PublicKey) => PublicKey.findProgramAddressSync([enc("band"), authority.toBuffer()], programId)[0];

/** What a browser wallet gives us (wallet-adapter's AnchorWallet shape). */
export interface WalletLike {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

/** Read-only wallet for fetching accounts; never signs. */
const readOnlyWallet: WalletLike = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error("read-only");
  },
  signAllTransactions: async () => {
    throw new Error("read-only");
  },
};

// Anchor's `Wallet` type is its Node wallet (it carries a Keypair); the
// provider only ever calls publicKey / signTransaction / signAllTransactions.
const asAnchorWallet = (w: WalletLike) => w as unknown as Wallet;

export function readProgram(): Program<Greenroom> {
  const provider = new AnchorProvider(connection, asAnchorWallet(readOnlyWallet), { commitment: "confirmed" });
  return new Program(idl as Idl as Greenroom, provider);
}

export function walletProgram(wallet: WalletLike): Program<Greenroom> {
  const provider = new AnchorProvider(connection, asAnchorWallet(wallet), { commitment: "confirmed", preflightCommitment: "confirmed" });
  return new Program(idl as Idl as Greenroom, provider);
}

export async function fetchShows(addresses: string[]): Promise<Map<string, ShowAccount | null>> {
  const program = readProgram();
  const keys = addresses.map((a) => new PublicKey(a));
  const accounts = await program.account.show.fetchMultiple(keys);
  const out = new Map<string, ShowAccount | null>();
  addresses.forEach((a, i) => out.set(a, accounts[i] ?? null));
  return out;
}

export async function fetchShow(address: string): Promise<ShowAccount | null> {
  return readProgram().account.show.fetchNullable(new PublicKey(address));
}

export async function fetchBand(profile: string): Promise<BandAccount | null> {
  return readProgram().account.bandProfile.fetchNullable(new PublicKey(profile));
}

export async function fetchVenue(profile: string): Promise<VenueAccount | null> {
  return readProgram().account.venueProfile.fetchNullable(new PublicKey(profile));
}

export async function fetchTicketsForShow(show: string): Promise<{ publicKey: PublicKey; account: TicketAccount }[]> {
  return readProgram().account.ticket.all([{ memcmp: { offset: 8, bytes: show } }]);
}

export async function fetchTicket(show: string, buyer: PublicKey): Promise<TicketAccount | null> {
  return readProgram().account.ticket.fetchNullable(ticketPda(new PublicKey(show), buyer));
}

export async function buyTicket(wallet: WalletLike, show: string, quantity: number): Promise<string> {
  const program = walletProgram(wallet);
  const showKey = new PublicKey(show);
  return program.methods
    .buyTicket(quantity, wallet.publicKey)
    .accountsPartial({
      payer: wallet.publicKey,
      show: showKey,
      vault: vaultPda(showKey),
      ticket: ticketPda(showKey, wallet.publicKey),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function refundTicket(wallet: WalletLike, show: string, buyer: PublicKey): Promise<string> {
  const program = walletProgram(wallet);
  const showKey = new PublicKey(show);
  return program.methods
    .refundTicket()
    .accountsPartial({ show: showKey, vault: vaultPda(showKey), ticket: ticketPda(showKey, buyer), buyer, systemProgram: SystemProgram.programId })
    .rpc();
}

export async function checkThreshold(wallet: WalletLike, show: string): Promise<string> {
  return walletProgram(wallet).methods.checkThreshold().accountsPartial({ show: new PublicKey(show) }).rpc();
}

// The chain clock barely drifts from wall time; ask once a minute, not every poll.
let clock: { offset: number; at: number } | null = null;

export async function chainTime(): Promise<number> {
  const local = Math.floor(Date.now() / 1000);
  if (clock && Date.now() - clock.at < 60_000) return local + clock.offset;
  try {
    const slot = await connection.getSlot("confirmed");
    const t = (await connection.getBlockTime(slot)) ?? local;
    clock = { offset: t - local, at: Date.now() };
    return t;
  } catch (e) {
    if (clock) return local + clock.offset;
    throw e;
  }
}

/** Create the band's on-chain profile, signed and paid by the connected wallet. */
export async function registerBand(wallet: WalletLike, name: string, genre: string): Promise<string> {
  return walletProgram(wallet)
    .methods.registerBand(name, genre)
    .accountsPartial({ authority: wallet.publicKey, bandProfile: bandPda(wallet.publicKey), systemProgram: SystemProgram.programId })
    .rpc();
}

export async function balanceLamports(address: PublicKey): Promise<number> {
  return connection.getBalance(address, "confirmed");
}

const ticketCache = new Map<string, { at: number; value: { publicKey: PublicKey; account: TicketAccount }[] }>();

/** Tickets a wallet holds as the fan (beneficiary), across every show; cached for a minute. */
export async function fetchTicketsOfWallet(owner: PublicKey): Promise<{ publicKey: PublicKey; account: TicketAccount }[]> {
  const key = owner.toBase58();
  const hit = ticketCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  // Ticket layout: discriminator (8) | show (32) | buyer (32) ...
  const value = await readProgram().account.ticket.all([{ memcmp: { offset: 40, bytes: key } }]);
  ticketCache.set(key, { at: Date.now(), value });
  return value;
}
