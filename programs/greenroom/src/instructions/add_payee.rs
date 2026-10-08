use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::PayeeAdded,
    state::{Payee, Show, ShowState},
};

#[derive(Accounts)]
pub struct AddPayee<'info> {
    pub band_authority: Signer<'info>,
    #[account(mut, has_one = band_authority @ ErrorCode::Unauthorized)]
    pub show: Account<'info, Show>,
}

pub fn handle_add_payee(ctx: Context<AddPayee>, address: Pubkey, bps: u16, label: String) -> Result<()> {
    let show = &mut ctx.accounts.show;
    require!(
        matches!(
            show.state,
            ShowState::Proposed | ShowState::OnSale | ShowState::Confirmed
        ),
        ErrorCode::InvalidState
    );
    require!(show.payees.len() < MAX_PAYEES as usize, ErrorCode::TooManyPayees);
    require!(!label.is_empty() && label.len() <= MAX_LABEL_LEN, ErrorCode::TextLength);
    require!(bps > 0 && bps < show.band_bps, ErrorCode::InvalidSplit);
    require!(
        address != show.band_authority
            && address != show.venue_authority
            && !show.payees.iter().any(|p| p.address == address),
        ErrorCode::DuplicatePayee
    );

    show.band_bps = show.band_bps.checked_sub(bps).ok_or(ErrorCode::MathOverflow)?;
    show.payees.push(Payee {
        address,
        bps,
        label: label.clone(),
    });

    emit!(PayeeAdded {
        show: show.key(),
        address,
        bps,
        label,
        band_bps_after: show.band_bps,
    });
    Ok(())
}
