use anchor_lang::prelude::*;

#[constant]
pub const BAND_SEED: &[u8] = b"band";
#[constant]
pub const VENUE_SEED: &[u8] = b"venue";
#[constant]
pub const TOUR_SEED: &[u8] = b"tour";
#[constant]
pub const SHOW_SEED: &[u8] = b"show";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
#[constant]
pub const TICKET_SEED: &[u8] = b"ticket";

/// Basis-point denominator used for thresholds and payout splits.
#[constant]
pub const BPS_DENOMINATOR: u64 = 10_000;
/// Maximum tickets one purchase (one `Ticket` account) can hold.
#[constant]
pub const MAX_TICKETS_PER_PURCHASE: u16 = 10;
/// Maximum extra payees (crew, services) a show can carry besides band and venue.
#[constant]
pub const MAX_PAYEES: u8 = 4;

pub const MAX_NAME_LEN: usize = 32;
pub const MAX_CITY_LEN: usize = 32;
pub const MAX_GENRE_LEN: usize = 16;
pub const MAX_REGION_LEN: usize = 16;
pub const MAX_LABEL_LEN: usize = 16;
