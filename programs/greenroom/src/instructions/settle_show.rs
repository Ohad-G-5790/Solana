use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::ShowSettled,
    state::{BandProfile, Show, ShowState, VenueProfile},
};

/// Permissionless crank: after the show date, pays the escrow out by the stored
/// split. Payees are passed as remaining accounts in the stored order.
#[derive(Accounts)]
pub struct SettleShow<'info> {
    #[account(
        mut,
        has_one = band_profile @ ErrorCode::Unauthorized,
        has_one = venue_profile @ ErrorCode::Unauthorized,
        has_one = band_authority @ ErrorCode::Unauthorized,
        has_one = venue_authority @ ErrorCode::Unauthorized,
    )]
    pub show: Account<'info, Show>,
    #[account(mut)]
    pub band_profile: Account<'info, BandProfile>,
    #[account(mut)]
    pub venue_profile: Account<'info, VenueProfile>,
    #[account(mut)]
    pub band_authority: SystemAccount<'info>,
    #[account(mut)]
    pub venue_authority: SystemAccount<'info>,
    #[account(mut, seeds = [VAULT_SEED, show.key().as_ref()], bump = show.vault_bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

fn share(total: u64, bps: u64) -> Result<u64> {
    let v = (total as u128)
        .checked_mul(bps as u128)
        .and_then(|x| x.checked_div(BPS_DENOMINATOR as u128))
        .ok_or(ErrorCode::MathOverflow)?;
    u64::try_from(v).map_err(|_| error!(ErrorCode::MathOverflow))
}

pub fn handle_settle_show<'info>(ctx: Context<'info, SettleShow<'info>>) -> Result<()> {
    let show = &mut ctx.accounts.show;
    require!(show.state == ShowState::Confirmed, ErrorCode::InvalidState);
    let now = Clock::get()?.unix_timestamp;
    require!(now >= show.date, ErrorCode::TooEarly);

    let payees = show.payees.clone();
    require!(ctx.remaining_accounts.len() == payees.len(), ErrorCode::PayeeMismatch);
    for (acc, payee) in ctx.remaining_accounts.iter().zip(payees.iter()) {
        require_keys_eq!(acc.key(), payee.address, ErrorCode::PayeeMismatch);
    }

    let total = show.escrow_lamports;
    // A system transfer may not leave a recipient below the rent-exempt
    // minimum, so a share too small to fund an empty wallet would block the
    // whole settlement. Such shares go to the band instead (the band's wallet
    // is funded: it paid the show's rent); nobody can hold a settlement hostage.
    let rent_floor = Rent::get()?.minimum_balance(0);
    let payable = |recipient_lamports: u64, amt: u64| -> u64 {
        if amt == 0 || recipient_lamports.saturating_add(amt) >= rent_floor {
            amt
        } else {
            0
        }
    };
    let venue_amount = payable(
        ctx.accounts.venue_authority.lamports(),
        share(total, show.venue_bps as u64)?,
    );
    let mut payee_total: u64 = 0;
    let mut payee_amounts = Vec::with_capacity(payees.len());
    for (acc, payee) in ctx.remaining_accounts.iter().zip(payees.iter()) {
        let amt = payable(acc.lamports(), share(total, payee.bps as u64)?);
        payee_total = payee_total.checked_add(amt).ok_or(ErrorCode::MathOverflow)?;
        payee_amounts.push(amt);
    }
    // Band takes the remainder, so rounding dust never gets stuck in the vault.
    let band_amount = total
        .checked_sub(venue_amount)
        .and_then(|x| x.checked_sub(payee_total))
        .ok_or(ErrorCode::MathOverflow)?;

    let show_key = show.key();
    let vault_bump = show.vault_bump;
    let seeds: &[&[u8]] = &[VAULT_SEED, show_key.as_ref(), &[vault_bump]];
    let signer_seeds = &[seeds];

    let transfer = |to: AccountInfo<'info>, amount: u64| -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to,
        };
        let cpi_ctx = CpiContext::new_with_signer(
            anchor_lang::system_program::ID,
            cpi_accounts,
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi_ctx, amount)
    };

    transfer(ctx.accounts.venue_authority.to_account_info(), venue_amount)?;
    for (acc, amt) in ctx.remaining_accounts.iter().zip(payee_amounts.iter()) {
        transfer(acc.clone(), *amt)?;
    }
    transfer(ctx.accounts.band_authority.to_account_info(), band_amount)?;

    show.escrow_lamports = 0;
    show.state = ShowState::Settled;

    let band = &mut ctx.accounts.band_profile;
    band.shows_completed = band.shows_completed.checked_add(1).ok_or(ErrorCode::MathOverflow)?;
    band.tickets_sold_total = band
        .tickets_sold_total
        .checked_add(show.tickets_sold as u64)
        .ok_or(ErrorCode::MathOverflow)?;
    band.gross_settled_lamports = band
        .gross_settled_lamports
        .checked_add(total)
        .ok_or(ErrorCode::MathOverflow)?;
    let venue = &mut ctx.accounts.venue_profile;
    venue.shows_hosted = venue.shows_hosted.checked_add(1).ok_or(ErrorCode::MathOverflow)?;

    emit!(ShowSettled {
        show: show_key,
        total_lamports: total,
        band_lamports: band_amount,
        venue_lamports: venue_amount,
        payee_lamports: payee_total,
        tickets_sold: show.tickets_sold,
    });
    Ok(())
}
