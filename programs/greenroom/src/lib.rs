//! Greenroom: AI agents book concert tours on Solana.
//!
//! Bands, venues and fans each act through an agent with its own wallet. A band
//! agent proposes shows, venue agents accept them, fans pay tickets into a
//! per-show escrow vault, and permissionless cranks confirm, cancel, refund and
//! settle shows purely from the stored deal terms and the clock.
#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8");

#[program]
pub mod greenroom {
    use super::*;

    /// Create the band's profile (its on-chain track record starts at zero).
    pub fn register_band(ctx: Context<RegisterBand>, name: String, genre: String) -> Result<()> {
        instructions::register_band::handle_register_band(ctx, name, genre)
    }

    /// Change the band's name; its track record stays as it is.
    pub fn rename_band(ctx: Context<RenameBand>, name: String) -> Result<()> {
        instructions::rename_band::handle_rename_band(ctx, name)
    }

    /// Create a venue profile with location and standing capacity.
    pub fn register_venue(
        ctx: Context<RegisterVenue>,
        name: String,
        city: String,
        lat_e6: i32,
        lng_e6: i32,
        capacity: u32,
    ) -> Result<()> {
        instructions::register_venue::handle_register_venue(ctx, name, city, lat_e6, lng_e6, capacity)
    }

    /// Open a tour: a date window and region the band agent will fill with shows.
    pub fn create_tour(
        ctx: Context<CreateTour>,
        tour_id: u32,
        name: String,
        region: String,
        starts_at: i64,
        ends_at: i64,
    ) -> Result<()> {
        instructions::create_tour::handle_create_tour(ctx, tour_id, name, region, starts_at, ends_at)
    }

    /// Band agent proposes a show at a venue with price, capacity, threshold and split.
    #[allow(clippy::too_many_arguments)]
    pub fn propose_show(
        ctx: Context<ProposeShow>,
        date: i64,
        ticket_price_lamports: u64,
        capacity: u32,
        threshold_bps: u16,
        threshold_deadline: i64,
        band_bps: u16,
        venue_bps: u16,
    ) -> Result<()> {
        instructions::propose_show::handle_propose_show(
            ctx,
            date,
            ticket_price_lamports,
            capacity,
            threshold_bps,
            threshold_deadline,
            band_bps,
            venue_bps,
        )
    }

    /// Venue agent accepts a proposed show; tickets go on sale.
    pub fn accept_show(ctx: Context<AcceptShow>) -> Result<()> {
        instructions::accept_show::handle_accept_show(ctx)
    }

    /// Venue agent rejects a proposed show; the account and vault float go back to the band.
    pub fn reject_show(ctx: Context<RejectShow>) -> Result<()> {
        instructions::reject_show::handle_reject_show(ctx)
    }

    /// Pay for tickets into the show's escrow. `beneficiary` receives any refund.
    pub fn buy_ticket(ctx: Context<BuyTicket>, quantity: u16, beneficiary: Pubkey) -> Result<()> {
        instructions::buy_ticket::handle_buy_ticket(ctx, quantity, beneficiary)
    }

    /// Permissionless: confirm the show once the threshold is met, or cancel it
    /// once the deadline passed without reaching it.
    pub fn check_threshold(ctx: Context<CheckThreshold>) -> Result<()> {
        instructions::check_threshold::handle_check_threshold(ctx)
    }

    /// Permissionless: refund one ticket of a cancelled show to its beneficiary.
    pub fn refund_ticket(ctx: Context<RefundTicket>) -> Result<()> {
        instructions::refund_ticket::handle_refund_ticket(ctx)
    }

    /// Permissionless: after the show date, split the escrow between band, venue and payees.
    pub fn settle_show<'info>(ctx: Context<'info, SettleShow<'info>>) -> Result<()> {
        instructions::settle_show::handle_settle_show(ctx)
    }

    /// Band agent adds a crew/service payee, carving its share out of the band's split.
    pub fn add_payee(ctx: Context<AddPayee>, address: Pubkey, bps: u16, label: String) -> Result<()> {
        instructions::add_payee::handle_add_payee(ctx, address, bps, label)
    }
}
