use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::TicketRefunded,
    state::{Show, ShowState, Ticket},
};

/// Permissionless crank: refunds one ticket of a cancelled show to the stored
/// beneficiary and closes the ticket account to that same beneficiary.
#[derive(Accounts)]
pub struct RefundTicket<'info> {
    #[account(mut)]
    pub show: Account<'info, Show>,
    #[account(mut, seeds = [VAULT_SEED, show.key().as_ref()], bump = show.vault_bump)]
    pub vault: SystemAccount<'info>,
    #[account(
        mut,
        close = buyer,
        has_one = show @ ErrorCode::PayeeMismatch,
        has_one = buyer @ ErrorCode::Unauthorized,
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(mut)]
    pub buyer: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_refund_ticket(ctx: Context<RefundTicket>) -> Result<()> {
    let show = &mut ctx.accounts.show;
    let ticket = &mut ctx.accounts.ticket;
    require!(show.state == ShowState::Cancelled, ErrorCode::InvalidState);
    require!(!ticket.refunded, ErrorCode::AlreadyRefunded);

    let amount = ticket.amount_lamports;
    let show_key = show.key();
    let seeds: &[&[u8]] = &[VAULT_SEED, show_key.as_ref(), &[show.vault_bump]];
    let signer_seeds = &[seeds];
    let cpi_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.buyer.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        anchor_lang::system_program::ID,
        cpi_accounts,
        signer_seeds,
    );
    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    ticket.refunded = true;
    show.escrow_lamports = show
        .escrow_lamports
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    show.tickets_refunded = show
        .tickets_refunded
        .checked_add(ticket.quantity as u32)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(TicketRefunded {
        show: show.key(),
        ticket: ticket.key(),
        buyer: ticket.buyer,
        amount_lamports: amount,
    });
    Ok(())
}
