use anchor_lang::prelude::*;

use crate::constants::BPS_DENOMINATOR;

/// A band (or artist). Its counters are the on-chain track record that venue
/// agents read as proof of past concerts; only `settle_show` can increase them.
#[account]
#[derive(InitSpace)]
pub struct BandProfile {
    pub authority: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(16)]
    pub genre: String,
    pub tours_created: u32,
    pub shows_completed: u32,
    pub tickets_sold_total: u64,
    pub gross_settled_lamports: u64,
    pub bump: u8,
}

/// A venue (club or hall) with its location and standing capacity.
#[account]
#[derive(InitSpace)]
pub struct VenueProfile {
    pub authority: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(32)]
    pub city: String,
    /// Latitude * 1e6
    pub lat_e6: i32,
    /// Longitude * 1e6
    pub lng_e6: i32,
    pub capacity: u32,
    pub shows_hosted: u32,
    pub bump: u8,
}

/// A tour groups the shows a band's agent books for one date window and region.
#[account]
#[derive(InitSpace)]
pub struct Tour {
    pub band_profile: Pubkey,
    pub tour_id: u32,
    #[max_len(32)]
    pub name: String,
    #[max_len(16)]
    pub region: String,
    pub starts_at: i64,
    pub ends_at: i64,
    pub shows_count: u16,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ShowState {
    /// Proposed by the band agent, waiting for the venue agent.
    Proposed,
    /// Accepted by the venue; tickets are on sale, threshold not yet decided.
    OnSale,
    /// Threshold met; the show will happen, tickets still on sale until the date.
    Confirmed,
    /// Deadline passed below threshold; every ticket is refundable.
    Cancelled,
    /// Show date passed and the escrow was paid out.
    Settled,
}

/// An extra party that receives a slice of the settlement (sound, lights, driver...).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug, InitSpace)]
pub struct Payee {
    pub address: Pubkey,
    pub bps: u16,
    #[max_len(16)]
    pub label: String,
}

/// One concert at one venue on one date, with its own escrow vault.
#[account]
#[derive(InitSpace)]
pub struct Show {
    pub tour: Pubkey,
    pub band_profile: Pubkey,
    pub venue_profile: Pubkey,
    pub band_authority: Pubkey,
    pub venue_authority: Pubkey,
    /// Unix timestamp of the show.
    pub date: i64,
    pub ticket_price_lamports: u64,
    /// Tickets offered for this show (at most the venue capacity).
    pub capacity: u32,
    /// Share of `capacity` that must be sold by `threshold_deadline`, in bps.
    pub threshold_bps: u16,
    /// Unix timestamp after which an unmet threshold cancels the show.
    pub threshold_deadline: i64,
    pub band_bps: u16,
    pub venue_bps: u16,
    pub tickets_sold: u32,
    pub tickets_refunded: u32,
    /// Lamports held for ticket holders (excludes the vault's rent float).
    pub escrow_lamports: u64,
    pub state: ShowState,
    pub bump: u8,
    pub vault_bump: u8,
    #[max_len(4)]
    pub payees: Vec<Payee>,
}

impl Show {
    /// Threshold test in integer math: sold / capacity >= threshold_bps / 10000.
    pub fn threshold_met(&self) -> bool {
        (self.tickets_sold as u64) * BPS_DENOMINATOR
            >= (self.capacity as u64) * (self.threshold_bps as u64)
    }

    /// Smallest ticket count that satisfies the threshold.
    pub fn tickets_required(&self) -> u32 {
        let num = (self.capacity as u64) * (self.threshold_bps as u64);
        num.div_ceil(BPS_DENOMINATOR) as u32
    }

    /// Sum of all payee shares in bps.
    pub fn payee_bps_total(&self) -> u64 {
        self.payees.iter().map(|p| p.bps as u64).sum()
    }
}

/// One purchase by one beneficiary for one show. Closed to the buyer on refund,
/// kept forever after settlement as proof of attendance.
#[account]
#[derive(InitSpace)]
pub struct Ticket {
    pub show: Pubkey,
    /// Beneficiary: receives the refund if the show is cancelled.
    pub buyer: Pubkey,
    /// Wallet that paid (may differ from `buyer`, e.g. a fan hub paying for fans).
    pub payer: Pubkey,
    pub quantity: u16,
    pub amount_lamports: u64,
    pub purchased_at: i64,
    pub refunded: bool,
    pub bump: u8,
}
