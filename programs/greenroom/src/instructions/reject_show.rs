use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::ShowRejected,
    state::{Show, ShowState},
};

#[derive(Accounts)]
pub struct RejectShow<'info> {
    pub venue_authority: Signer<'info>,
    /// Receives the show account rent and the vault float back.
    #[account(mut)]
    pub band_authority: SystemAccount<'info>,
    #[account(
        mut,
        close = band_authority,
        has_one = venue_authority @ ErrorCode::Unauthorized,
        has_one = band_authority @ ErrorCode::Unauthorized,
    )]
    pub show: Account<'info, Show>,
    #[account(mut, seeds = [VAULT_SEED, show.key().as_ref()], bump = show.vault_bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_reject_show(ctx: Context<RejectShow>) -> Result<()> {
    let show = &ctx.accounts.show;
    require!(show.state == ShowState::Proposed, ErrorCode::InvalidState);

    // Return the whole vault balance (only the float exists before sales).
    let balance = ctx.accounts.vault.lamports();
    if balance > 0 {
        let show_key = show.key();
        let seeds: &[&[u8]] = &[VAULT_SEED, show_key.as_ref(), &[show.vault_bump]];
        let signer_seeds = &[seeds];
        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.band_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            anchor_lang::system_program::ID,
            cpi_accounts,
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi_ctx, balance)?;
    }

    emit!(ShowRejected {
        show: show.key(),
        venue_authority: ctx.accounts.venue_authority.key(),
    });
    Ok(())
}
