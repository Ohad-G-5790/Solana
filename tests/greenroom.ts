import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { Greenroom } from "../target/types/greenroom";

// ---------- helpers ----------

const u32le = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
const i64le = (n: number | BN) => {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n.toString()));
  return b;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);
/** The program reads Clock::unix_timestamp, which can lag wall-clock on a busy local validator. */
async function chainNow(conn: anchor.web3.Connection): Promise<number> {
  const slot = await conn.getSlot("confirmed");
  return (await conn.getBlockTime(slot)) ?? now();
}
async function waitChain(conn: anchor.web3.Connection, t: number): Promise<void> {
  while ((await chainNow(conn)) < t) await sleep(1000);
}

async function expectAnchorError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e: any) {
    const got = e?.error?.errorCode?.code ?? e?.errorCode?.code ?? String(e);
    expect(got, `expected ${code}, got ${got}`).to.equal(code);
    return;
  }
  expect.fail(`expected error ${code} but the transaction succeeded`);
}

describe("greenroom", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Greenroom as Program<Greenroom>;
  const conn = provider.connection;

  const bandAuth = Keypair.generate();
  const venueAuthA = Keypair.generate();
  const venueAuthB = Keypair.generate();
  const fan1 = Keypair.generate();
  const fan2 = Keypair.generate();
  const hub = Keypair.generate();
  const crew = Keypair.generate();
  const stranger = Keypair.generate();

  const pid = program.programId;
  const [bandPda] = PublicKey.findProgramAddressSync([Buffer.from("band"), bandAuth.publicKey.toBuffer()], pid);
  const [venueA] = PublicKey.findProgramAddressSync([Buffer.from("venue"), venueAuthA.publicKey.toBuffer()], pid);
  const [venueB] = PublicKey.findProgramAddressSync([Buffer.from("venue"), venueAuthB.publicKey.toBuffer()], pid);
  const [tourPda] = PublicKey.findProgramAddressSync([Buffer.from("tour"), bandPda.toBuffer(), u32le(0)], pid);
  const showPda = (venue: PublicKey, date: number) =>
    PublicKey.findProgramAddressSync([Buffer.from("show"), tourPda.toBuffer(), venue.toBuffer(), i64le(date)], pid)[0];
  const vaultPda = (show: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("vault"), show.toBuffer()], pid)[0];
  const ticketPda = (show: PublicKey, buyer: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("ticket"), show.toBuffer(), buyer.toBuffer()], pid)[0];

  const fund = async (to: PublicKey, sol: number) => {
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({ fromPubkey: provider.wallet.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) })
    );
    await provider.sendAndConfirm(tx);
  };

  const PRICE = new BN(0.01 * LAMPORTS_PER_SOL);
  const T0 = now();
  const tourStart = T0 - 60;
  const tourEnd = T0 + 3600;

  // Every transaction takes ~1s on the local validator, so the demo clock
  // leaves room: show 1 is confirmed early and settled after its date,
  // show 2 misses its deadline and is cancelled, show 3 is rejected.
  const date1 = T0 + 75;
  const deadline1 = T0 + 60;
  const date2 = T0 + 240;
  const deadline2 = T0 + 55;
  const date3 = T0 + 300;
  const deadline3 = T0 + 250;

  let show1: PublicKey, show2: PublicKey, show3: PublicKey;

  before(async () => {
    const wallets = [bandAuth, venueAuthA, venueAuthB, fan1, fan2, hub, crew, stranger];
    for (const w of wallets) await fund(w.publicKey, 5);
    show1 = showPda(venueA, date1);
    show2 = showPda(venueB, date2);
    show3 = showPda(venueA, date3);
  });

  // ---------- profiles ----------

  it("registers a band", async () => {
    await program.methods
      .registerBand("The Static Orchards", "indie")
      .accounts({ authority: bandAuth.publicKey, bandProfile: bandPda, systemProgram: SystemProgram.programId })
      .signers([bandAuth])
      .rpc();
    const band = await program.account.bandProfile.fetch(bandPda);
    expect(band.name).to.equal("The Static Orchards");
    expect(band.showsCompleted).to.equal(0);
    expect(band.toursCreated).to.equal(0);
  });

  it("rejects a band name that is too long", async () => {
    const other = Keypair.generate();
    await fund(other.publicKey, 1);
    const [pda] = PublicKey.findProgramAddressSync([Buffer.from("band"), other.publicKey.toBuffer()], pid);
    await expectAnchorError(
      program.methods
        .registerBand("x".repeat(33), "indie")
        .accounts({ authority: other.publicKey, bandProfile: pda, systemProgram: SystemProgram.programId })
        .signers([other])
        .rpc(),
      "TextLength"
    );
  });

  it("registers two venues and rejects zero capacity", async () => {
    await program.methods
      .registerVenue("Lido", "Berlin", 52499000, 13452000, 10)
      .accounts({ authority: venueAuthA.publicKey, venueProfile: venueA, systemProgram: SystemProgram.programId })
      .signers([venueAuthA])
      .rpc();
    await program.methods
      .registerVenue("Fleda", "Brno", 49200000, 16600000, 10)
      .accounts({ authority: venueAuthB.publicKey, venueProfile: venueB, systemProgram: SystemProgram.programId })
      .signers([venueAuthB])
      .rpc();
    const v = await program.account.venueProfile.fetch(venueA);
    expect(v.city).to.equal("Berlin");
    expect(v.capacity).to.equal(10);

    const bad = Keypair.generate();
    await fund(bad.publicKey, 1);
    const [pda] = PublicKey.findProgramAddressSync([Buffer.from("venue"), bad.publicKey.toBuffer()], pid);
    await expectAnchorError(
      program.methods
        .registerVenue("Nowhere", "Nowhere", 0, 0, 0)
        .accounts({ authority: bad.publicKey, venueProfile: pda, systemProgram: SystemProgram.programId })
        .signers([bad])
        .rpc(),
      "InvalidCapacity"
    );
  });

  // ---------- tour ----------

  it("creates a tour and enforces sequential ids and date order", async () => {
    await expectAnchorError(
      program.methods
        .createTour(0, "Backwards", "EU", new BN(tourEnd), new BN(tourStart))
        .accounts({ bandAuthority: bandAuth.publicKey, bandProfile: bandPda, tour: tourPda, systemProgram: SystemProgram.programId })
        .signers([bandAuth])
        .rpc(),
      "InvalidDates"
    );
    const [wrongTour] = PublicKey.findProgramAddressSync([Buffer.from("tour"), bandPda.toBuffer(), u32le(7)], pid);
    await expectAnchorError(
      program.methods
        .createTour(7, "Skipped", "EU", new BN(tourStart), new BN(tourEnd))
        .accounts({ bandAuthority: bandAuth.publicKey, bandProfile: bandPda, tour: wrongTour, systemProgram: SystemProgram.programId })
        .signers([bandAuth])
        .rpc(),
      "WrongTourId"
    );
    await program.methods
      .createTour(0, "Central Europe 2026", "EU", new BN(tourStart), new BN(tourEnd))
      .accounts({ bandAuthority: bandAuth.publicKey, bandProfile: bandPda, tour: tourPda, systemProgram: SystemProgram.programId })
      .signers([bandAuth])
      .rpc();
    const tour = await program.account.tour.fetch(tourPda);
    expect(tour.tourId).to.equal(0);
    expect(tour.showsCount).to.equal(0);
    const band = await program.account.bandProfile.fetch(bandPda);
    expect(band.toursCreated).to.equal(1);
  });

  // ---------- proposals ----------

  const propose = (show: PublicKey, venue: PublicKey, date: number, deadline: number, opts?: Partial<{ capacity: number; thr: number; band: number; venue: number; price: BN }>) =>
    program.methods
      .proposeShow(new BN(date), opts?.price ?? PRICE, opts?.capacity ?? 10, opts?.thr ?? 5000, new BN(deadline), opts?.band ?? 7000, opts?.venue ?? 3000)
      .accounts({
        bandAuthority: bandAuth.publicKey,
        bandProfile: bandPda,
        tour: tourPda,
        venueProfile: venue,
        show,
        vault: vaultPda(show),
        systemProgram: SystemProgram.programId,
      })
      .signers([bandAuth])
      .rpc();

  it("validates proposals", async () => {
    await expectAnchorError(propose(show1, venueA, date1, deadline1, { band: 6000, venue: 3000 }), "InvalidSplit");
    await expectAnchorError(propose(show1, venueA, date1, deadline1, { capacity: 11 }), "CapacityExceedsVenue");
    await expectAnchorError(propose(show1, venueA, date1, date1 + 1), "InvalidDates");
    const outside = showPda(venueA, tourEnd + 10);
    await expectAnchorError(propose(outside, venueA, tourEnd + 10, tourEnd), "InvalidDates");
    await expectAnchorError(propose(show1, venueA, date1, deadline1, { thr: 0 }), "InvalidThreshold");
  });

  it("proposes three shows and funds the vault float", async () => {
    await propose(show1, venueA, date1, deadline1);
    await propose(show2, venueB, date2, deadline2);
    await propose(show3, venueA, date3, deadline3);
    const s = await program.account.show.fetch(show1);
    expect(s.state).to.deep.equal({ proposed: {} });
    expect(s.capacity).to.equal(10);
    expect(s.bandBps).to.equal(7000);
    const vaultBal = await conn.getBalance(vaultPda(show1));
    const float = await conn.getMinimumBalanceForRentExemption(0);
    expect(vaultBal).to.equal(float);
    const tour = await program.account.tour.fetch(tourPda);
    expect(tour.showsCount).to.equal(3);
  });

  it("only the venue authority can accept, and only once", async () => {
    await expectAnchorError(
      program.methods.acceptShow().accounts({ venueAuthority: stranger.publicKey, show: show1 }).signers([stranger]).rpc(),
      "Unauthorized"
    );
    await program.methods.acceptShow().accounts({ venueAuthority: venueAuthA.publicKey, show: show1 }).signers([venueAuthA]).rpc();
    await program.methods.acceptShow().accounts({ venueAuthority: venueAuthB.publicKey, show: show2 }).signers([venueAuthB]).rpc();
    const s = await program.account.show.fetch(show1);
    expect(s.state).to.deep.equal({ onSale: {} });
    await expectAnchorError(
      program.methods.acceptShow().accounts({ venueAuthority: venueAuthA.publicKey, show: show1 }).signers([venueAuthA]).rpc(),
      "InvalidState"
    );
  });

  it("venue can reject a proposed show; rent and float return to the band", async () => {
    await expectAnchorError(
      program.methods
        .rejectShow()
        .accounts({ venueAuthority: stranger.publicKey, bandAuthority: bandAuth.publicKey, show: show3, vault: vaultPda(show3), systemProgram: SystemProgram.programId })
        .signers([stranger])
        .rpc(),
      "Unauthorized"
    );
    const before = await conn.getBalance(bandAuth.publicKey);
    await program.methods
      .rejectShow()
      .accounts({
        venueAuthority: venueAuthA.publicKey,
        bandAuthority: bandAuth.publicKey,
        show: show3,
        vault: vaultPda(show3),
        systemProgram: SystemProgram.programId,
      })
      .signers([venueAuthA])
      .rpc();
    const after = await conn.getBalance(bandAuth.publicKey);
    expect(after).to.be.greaterThan(before);
    expect(await conn.getAccountInfo(show3)).to.equal(null);
    expect(await conn.getBalance(vaultPda(show3))).to.equal(0);
  });

  // ---------- tickets ----------

  const buy = (show: PublicKey, payer: Keypair, beneficiary: PublicKey, qty: number) =>
    program.methods
      .buyTicket(qty, beneficiary)
      .accounts({ payer: payer.publicKey, show, vault: vaultPda(show), ticket: ticketPda(show, beneficiary), systemProgram: SystemProgram.programId })
      .signers([payer])
      .rpc();

  it("sells tickets into escrow, for self and on behalf of others", async () => {
    await expectAnchorError(buy(show1, fan1, fan1.publicKey, 0), "InvalidQuantity");
    await expectAnchorError(buy(show1, fan1, fan1.publicKey, 11), "InvalidQuantity");
    await buy(show1, fan1, fan1.publicKey, 3);
    await buy(show1, hub, fan2.publicKey, 2);
    await expectAnchorError(buy(show1, stranger, stranger.publicKey, 8), "SoldOut");

    const s = await program.account.show.fetch(show1);
    expect(s.ticketsSold).to.equal(5);
    expect(s.escrowLamports.toString()).to.equal(PRICE.muln(5).toString());
    const float = await conn.getMinimumBalanceForRentExemption(0);
    expect(await conn.getBalance(vaultPda(show1))).to.equal(float + PRICE.muln(5).toNumber());

    const t = await program.account.ticket.fetch(ticketPda(show1, fan2.publicKey));
    expect(t.buyer.toBase58()).to.equal(fan2.publicKey.toBase58());
    expect(t.payer.toBase58()).to.equal(hub.publicKey.toBase58());
    expect(t.quantity).to.equal(2);

    // show 2: 2 of 10 sold (20% < 50%); the crank must refuse to decide before the deadline
    await buy(show2, fan1, fan1.publicKey, 2);
    expect(await chainNow(conn)).to.be.lessThan(deadline2);
    await expectAnchorError(program.methods.checkThreshold().accounts({ show: show2 }).rpc(), "TooEarly");
  });

  it("confirms a show as soon as the threshold is met, from any wallet", async () => {
    // 5 of 10 sold = 50% >= 5000 bps, before the deadline
    await program.methods.checkThreshold().accounts({ show: show1 }).rpc();
    const s = await program.account.show.fetch(show1);
    expect(s.state).to.deep.equal({ confirmed: {} });
    await expectAnchorError(program.methods.checkThreshold().accounts({ show: show1 }).rpc(), "InvalidState");
    // sales continue after confirmation
    await buy(show1, stranger, stranger.publicKey, 1);
    expect((await program.account.show.fetch(show1)).ticketsSold).to.equal(6);
  });

  it("adds a crew payee out of the band's share", async () => {
    await expectAnchorError(
      program.methods.addPayee(crew.publicKey, 1000, "sound").accounts({ bandAuthority: stranger.publicKey, show: show1 }).signers([stranger]).rpc(),
      "Unauthorized"
    );
    await expectAnchorError(
      program.methods.addPayee(crew.publicKey, 7000, "sound").accounts({ bandAuthority: bandAuth.publicKey, show: show1 }).signers([bandAuth]).rpc(),
      "InvalidSplit"
    );
    await program.methods.addPayee(crew.publicKey, 1000, "sound").accounts({ bandAuthority: bandAuth.publicKey, show: show1 }).signers([bandAuth]).rpc();
    await expectAnchorError(
      program.methods.addPayee(crew.publicKey, 500, "lights").accounts({ bandAuthority: bandAuth.publicKey, show: show1 }).signers([bandAuth]).rpc(),
      "DuplicatePayee"
    );
    const s = await program.account.show.fetch(show1);
    expect(s.bandBps).to.equal(6000);
    expect(s.payees.length).to.equal(1);
    expect(s.payees[0].label).to.equal("sound");
  });

  it("settles after the show date and splits the escrow", async () => {
    const settle = (remaining: PublicKey[]) =>
      program.methods
        .settleShow()
        .accounts({
          show: show1,
          bandProfile: bandPda,
          venueProfile: venueA,
          bandAuthority: bandAuth.publicKey,
          venueAuthority: venueAuthA.publicKey,
          vault: vaultPda(show1),
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remaining.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true })))
        .rpc();

    await expectAnchorError(settle([crew.publicKey]), "TooEarly");
    await waitChain(conn, date1 + 1);
    await expectAnchorError(settle([]), "PayeeMismatch");
    await expectAnchorError(settle([stranger.publicKey]), "PayeeMismatch");

    const bandBefore = await conn.getBalance(bandAuth.publicKey);
    const venueBefore = await conn.getBalance(venueAuthA.publicKey);
    const crewBefore = await conn.getBalance(crew.publicKey);
    await settle([crew.publicKey]);

    const total = PRICE.muln(6).toNumber();
    expect((await conn.getBalance(venueAuthA.publicKey)) - venueBefore).to.equal(Math.floor(total * 0.3));
    expect((await conn.getBalance(crew.publicKey)) - crewBefore).to.equal(Math.floor(total * 0.1));
    expect((await conn.getBalance(bandAuth.publicKey)) - bandBefore).to.equal(total - Math.floor(total * 0.3) - Math.floor(total * 0.1));

    const s = await program.account.show.fetch(show1);
    expect(s.state).to.deep.equal({ settled: {} });
    expect(s.escrowLamports.toNumber()).to.equal(0);
    const band = await program.account.bandProfile.fetch(bandPda);
    expect(band.showsCompleted).to.equal(1);
    expect(band.ticketsSoldTotal.toNumber()).to.equal(6);
    expect(band.grossSettledLamports.toNumber()).to.equal(total);
    expect((await program.account.venueProfile.fetch(venueA)).showsHosted).to.equal(1);
    const float = await conn.getMinimumBalanceForRentExemption(0);
    expect(await conn.getBalance(vaultPda(show1))).to.equal(float);
    await expectAnchorError(settle([crew.publicKey]), "InvalidState");
  });

  // ---------- cancellation and refunds ----------

  it("cancels an under-sold show after the deadline and refunds every ticket", async () => {
    await waitChain(conn, deadline2 + 1);
    // after the deadline nobody can rescue an undecided show with late purchases
    await expectAnchorError(buy(show2, fan2, fan2.publicKey, 8), "SalesClosed");
    await program.methods.checkThreshold().accounts({ show: show2 }).rpc();
    let s = await program.account.show.fetch(show2);
    expect(s.state).to.deep.equal({ cancelled: {} });

    await expectAnchorError(buy(show2, fan2, fan2.publicKey, 1), "InvalidState");

    const refund = () =>
      program.methods
        .refundTicket()
        .accounts({ show: show2, vault: vaultPda(show2), ticket: ticketPda(show2, fan1.publicKey), buyer: fan1.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
    const before = await conn.getBalance(fan1.publicKey);
    await refund();
    const after = await conn.getBalance(fan1.publicKey);
    // refund + closed ticket rent
    expect(after - before).to.be.greaterThan(PRICE.muln(2).toNumber());
    expect(await conn.getAccountInfo(ticketPda(show2, fan1.publicKey))).to.equal(null);
    s = await program.account.show.fetch(show2);
    expect(s.escrowLamports.toNumber()).to.equal(0);
    expect(s.ticketsRefunded).to.equal(2);
    const float = await conn.getMinimumBalanceForRentExemption(0);
    expect(await conn.getBalance(vaultPda(show2))).to.equal(float);

    let failed = false;
    try {
      await refund();
    } catch {
      failed = true;
    }
    expect(failed, "second refund must fail (ticket closed)").to.equal(true);

    await expectAnchorError(
      program.methods
        .settleShow()
        .accounts({
          show: show2,
          bandProfile: bandPda,
          venueProfile: venueB,
          bandAuthority: bandAuth.publicKey,
          venueAuthority: venueAuthB.publicKey,
          vault: vaultPda(show2),
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "InvalidState"
    );
  });
});
