use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, events::BandRenamed, state::BandProfile};

#[derive(Accounts)]
pub struct RenameBand<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [BAND_SEED, authority.key().as_ref()],
        bump = band_profile.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub band_profile: Account<'info, BandProfile>,
}

/// A band changes its name; its track record (tours, shows, tickets, money) is untouched.
pub fn handle_rename_band(ctx: Context<RenameBand>, name: String) -> Result<()> {
    require!(!name.is_empty() && name.len() <= MAX_NAME_LEN, ErrorCode::TextLength);

    let band = &mut ctx.accounts.band_profile;
    let old_name = std::mem::replace(&mut band.name, name.clone());

    emit!(BandRenamed {
        band_profile: band.key(),
        old_name,
        name,
    });
    Ok(())
}
