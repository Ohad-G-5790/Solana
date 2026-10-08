use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, events::VenueRegistered, state::VenueProfile};

#[derive(Accounts)]
pub struct RegisterVenue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + VenueProfile::INIT_SPACE,
        seeds = [VENUE_SEED, authority.key().as_ref()],
        bump
    )]
    pub venue_profile: Account<'info, VenueProfile>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_venue(
    ctx: Context<RegisterVenue>,
    name: String,
    city: String,
    lat_e6: i32,
    lng_e6: i32,
    capacity: u32,
) -> Result<()> {
    require!(!name.is_empty() && name.len() <= MAX_NAME_LEN, ErrorCode::TextLength);
    require!(!city.is_empty() && city.len() <= MAX_CITY_LEN, ErrorCode::TextLength);
    require!(capacity > 0, ErrorCode::InvalidCapacity);

    let venue = &mut ctx.accounts.venue_profile;
    venue.authority = ctx.accounts.authority.key();
    venue.name = name.clone();
    venue.city = city.clone();
    venue.lat_e6 = lat_e6;
    venue.lng_e6 = lng_e6;
    venue.capacity = capacity;
    venue.shows_hosted = 0;
    venue.bump = ctx.bumps.venue_profile;

    emit!(VenueRegistered {
        venue_profile: venue.key(),
        authority: venue.authority,
        name,
        city,
        capacity,
    });
    Ok(())
}
