use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, events::BandRegistered, state::BandProfile};

#[derive(Accounts)]
pub struct RegisterBand<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + BandProfile::INIT_SPACE,
        seeds = [BAND_SEED, authority.key().as_ref()],
        bump
    )]
    pub band_profile: Account<'info, BandProfile>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_band(ctx: Context<RegisterBand>, name: String, genre: String) -> Result<()> {
    require!(!name.is_empty() && name.len() <= MAX_NAME_LEN, ErrorCode::TextLength);
    require!(genre.len() <= MAX_GENRE_LEN, ErrorCode::TextLength);

    let band = &mut ctx.accounts.band_profile;
    band.authority = ctx.accounts.authority.key();
    band.name = name.clone();
    band.genre = genre;
    band.tours_created = 0;
    band.shows_completed = 0;
    band.tickets_sold_total = 0;
    band.gross_settled_lamports = 0;
    band.bump = ctx.bumps.band_profile;

    emit!(BandRegistered {
        band_profile: band.key(),
        authority: band.authority,
        name,
    });
    Ok(())
}
