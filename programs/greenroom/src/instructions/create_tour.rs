use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::TourCreated,
    state::{BandProfile, Tour},
};

#[derive(Accounts)]
#[instruction(tour_id: u32)]
pub struct CreateTour<'info> {
    #[account(mut)]
    pub band_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [BAND_SEED, band_authority.key().as_ref()],
        bump = band_profile.bump,
        constraint = band_profile.authority == band_authority.key() @ ErrorCode::Unauthorized,
    )]
    pub band_profile: Account<'info, BandProfile>,
    #[account(
        init,
        payer = band_authority,
        space = 8 + Tour::INIT_SPACE,
        seeds = [TOUR_SEED, band_profile.key().as_ref(), &tour_id.to_le_bytes()],
        bump
    )]
    pub tour: Account<'info, Tour>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_tour(
    ctx: Context<CreateTour>,
    tour_id: u32,
    name: String,
    region: String,
    starts_at: i64,
    ends_at: i64,
) -> Result<()> {
    require!(!name.is_empty() && name.len() <= MAX_NAME_LEN, ErrorCode::TextLength);
    require!(region.len() <= MAX_REGION_LEN, ErrorCode::TextLength);
    require!(starts_at < ends_at, ErrorCode::InvalidDates);

    let band = &mut ctx.accounts.band_profile;
    require!(tour_id == band.tours_created, ErrorCode::WrongTourId);
    band.tours_created = band.tours_created.checked_add(1).ok_or(ErrorCode::MathOverflow)?;

    let tour = &mut ctx.accounts.tour;
    tour.band_profile = band.key();
    tour.tour_id = tour_id;
    tour.name = name.clone();
    tour.region = region;
    tour.starts_at = starts_at;
    tour.ends_at = ends_at;
    tour.shows_count = 0;
    tour.bump = ctx.bumps.tour;

    emit!(TourCreated {
        tour: tour.key(),
        band_profile: band.key(),
        tour_id,
        name,
        starts_at,
        ends_at,
    });
    Ok(())
}
