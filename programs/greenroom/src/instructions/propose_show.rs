use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::ShowProposed,
    state::{BandProfile, Show, ShowState, Tour, VenueProfile},
};

#[derive(Accounts)]
#[instruction(date: i64)]
pub struct ProposeShow<'info> {
    #[account(mut)]
    pub band_authority: Signer<'info>,
    #[account(
        seeds = [BAND_SEED, band_authority.key().as_ref()],
        bump = band_profile.bump,
        constraint = band_profile.authority == band_authority.key() @ ErrorCode::Unauthorized,
    )]
    pub band_profile: Account<'info, BandProfile>,
    #[account(
        mut,
        seeds = [TOUR_SEED, band_profile.key().as_ref(), &tour.tour_id.to_le_bytes()],
        bump = tour.bump,
        has_one = band_profile @ ErrorCode::Unauthorized,
    )]
    pub tour: Account<'info, Tour>,
    #[account(
        seeds = [VENUE_SEED, venue_profile.authority.as_ref()],
        bump = venue_profile.bump,
    )]
    pub venue_profile: Account<'info, VenueProfile>,
    #[account(
        init,
        payer = band_authority,
        space = 8 + Show::INIT_SPACE,
        seeds = [SHOW_SEED, tour.key().as_ref(), venue_profile.key().as_ref(), &date.to_le_bytes()],
        bump
    )]
    pub show: Account<'info, Show>,
    /// Escrow vault: a system-owned PDA that only this program can sign for.
    #[account(mut, seeds = [VAULT_SEED, show.key().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_propose_show(
    ctx: Context<ProposeShow>,
    date: i64,
    ticket_price_lamports: u64,
    capacity: u32,
    threshold_bps: u16,
    threshold_deadline: i64,
    band_bps: u16,
    venue_bps: u16,
) -> Result<()> {
    let tour = &mut ctx.accounts.tour;
    let venue = &ctx.accounts.venue_profile;

    require!(date >= tour.starts_at && date <= tour.ends_at, ErrorCode::InvalidDates);
    require!(threshold_deadline > 0 && threshold_deadline < date, ErrorCode::InvalidDates);
    require!(ticket_price_lamports > 0, ErrorCode::InvalidPrice);
    require!(capacity > 0, ErrorCode::InvalidCapacity);
    require!(capacity <= venue.capacity, ErrorCode::CapacityExceedsVenue);
    require!(
        threshold_bps > 0 && (threshold_bps as u64) <= BPS_DENOMINATOR,
        ErrorCode::InvalidThreshold
    );
    require!(
        band_bps > 0 && venue_bps > 0 && (band_bps as u64) + (venue_bps as u64) == BPS_DENOMINATOR,
        ErrorCode::InvalidSplit
    );

    let show = &mut ctx.accounts.show;
    show.tour = tour.key();
    show.band_profile = ctx.accounts.band_profile.key();
    show.venue_profile = venue.key();
    show.band_authority = ctx.accounts.band_authority.key();
    show.venue_authority = venue.authority;
    show.date = date;
    show.ticket_price_lamports = ticket_price_lamports;
    show.capacity = capacity;
    show.threshold_bps = threshold_bps;
    show.threshold_deadline = threshold_deadline;
    show.band_bps = band_bps;
    show.venue_bps = venue_bps;
    show.tickets_sold = 0;
    show.tickets_refunded = 0;
    show.escrow_lamports = 0;
    show.state = ShowState::Proposed;
    show.bump = ctx.bumps.show;
    show.vault_bump = ctx.bumps.vault;
    show.payees = Vec::new();

    tour.shows_count = tour.shows_count.checked_add(1).ok_or(ErrorCode::MathOverflow)?;

    // Fund the vault with the rent-exempt minimum for a data-less account so it
    // can exist with a balance below any single ticket price. This float stays
    // in the vault; refunds and settlement only move `escrow_lamports`.
    let float = Rent::get()?.minimum_balance(0);
    let existing = ctx.accounts.vault.lamports();
    if existing < float {
        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.band_authority.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(anchor_lang::system_program::ID, cpi_accounts);
        anchor_lang::system_program::transfer(cpi_ctx, float - existing)?;
    }

    emit!(ShowProposed {
        show: show.key(),
        tour: tour.key(),
        venue_profile: venue.key(),
        date,
        ticket_price_lamports,
        capacity,
        threshold_bps,
        threshold_deadline,
    });
    Ok(())
}
