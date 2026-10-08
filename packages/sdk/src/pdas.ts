import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8");

const enc = (s: string) => Buffer.from(s);
export const u32le = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
export const i64le = (n: number | bigint): Buffer => {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n));
  return b;
};

export function bandPda(authority: PublicKey, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([enc("band"), authority.toBuffer()], programId)[0];
}
export function venuePda(authority: PublicKey, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([enc("venue"), authority.toBuffer()], programId)[0];
}
export function tourPda(bandProfile: PublicKey, tourId: number, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([enc("tour"), bandProfile.toBuffer(), u32le(tourId)], programId)[0];
}
export function showPda(tour: PublicKey, venueProfile: PublicKey, date: number, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc("show"), tour.toBuffer(), venueProfile.toBuffer(), i64le(date)],
    programId
  )[0];
}
export function vaultPda(show: PublicKey, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([enc("vault"), show.toBuffer()], programId)[0];
}
export function ticketPda(show: PublicKey, buyer: PublicKey, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([enc("ticket"), show.toBuffer(), buyer.toBuffer()], programId)[0];
}
