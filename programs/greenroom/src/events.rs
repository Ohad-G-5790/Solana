use anchor_lang::prelude::*;

#[event]
pub struct BandRegistered {
    pub band_profile: Pubkey,
    pub authority: Pubkey,
    pub name: String,
}

#[event]
pub struct VenueRegistered {
    pub venue_profile: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub city: String,
    pub capacity: u32,
}

#[event]
pub struct TourCreated {
    pub tour: Pubkey,
    pub band_profile: Pubkey,
    pub tour_id: u32,
    pub name: String,
    pub starts_at: i64,
    pub ends_at: i64,
}

#[event]
pub struct ShowProposed {
    pub show: Pubkey,
    pub tour: Pubkey,
    pub venue_profile: Pubkey,
    pub date: i64,
    pub ticket_price_lamports: u64,
    pub capacity: u32,
    pub threshold_bps: u16,
    pub threshold_deadline: i64,
}

#[event]
pub struct ShowAccepted {
    pub show: Pubkey,
    pub venue_authority: Pubkey,
}

#[event]
pub struct ShowRejected {
    pub show: Pubkey,
    pub venue_authority: Pubkey,
}

#[event]
pub struct TicketBought {
    pub show: Pubkey,
    pub ticket: Pubkey,
    pub buyer: Pubkey,
    pub payer: Pubkey,
    pub quantity: u16,
    pub amount_lamports: u64,
    pub tickets_sold: u32,
    pub threshold_met: bool,
}

#[event]
pub struct ShowConfirmed {
    pub show: Pubkey,
    pub tickets_sold: u32,
    pub capacity: u32,
}

#[event]
pub struct ShowCancelled {
    pub show: Pubkey,
    pub tickets_sold: u32,
    pub tickets_required: u32,
}

#[event]
pub struct TicketRefunded {
    pub show: Pubkey,
    pub ticket: Pubkey,
    pub buyer: Pubkey,
    pub amount_lamports: u64,
}

#[event]
pub struct ShowSettled {
    pub show: Pubkey,
    pub total_lamports: u64,
    pub band_lamports: u64,
    pub venue_lamports: u64,
    pub payee_lamports: u64,
    pub tickets_sold: u32,
}

#[event]
pub struct PayeeAdded {
    pub show: Pubkey,
    pub address: Pubkey,
    pub bps: u16,
    pub label: String,
    pub band_bps_after: u16,
}
