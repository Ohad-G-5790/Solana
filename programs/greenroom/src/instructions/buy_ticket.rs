use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::TicketBought,
    state::{Show, ShowState, Ticket},
};

#[derive(Accounts)]
#[instruction(quantity: u16, beneficiary: Pubkey)]
pub struct BuyTicket<'info> {
    /// Pays the tickets and the ticket account rent. May be a fan's own wallet
    /// or a hub wallet buying on behalf of `beneficiary`.
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub show: Account<'info, Show>,
    #[account(mut, seeds = [VAULT_SEED, show.key().as_ref()], bump = show.vault_bump)]
    pub vault: SystemAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Ticket::INIT_SPACE,
        seeds = [TICKET_SEED, show.key().as_ref(), beneficiary.as_ref()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
    pub system_program: Program<'info, System>,
}

pub fn handle_buy_ticket(ctx: Context<BuyTicket>, quantity: u16, beneficiary: Pubkey) -> Result<()> {
    let show = &mut ctx.accounts.show;
    require!(
        matches!(show.state, ShowState::OnSale | ShowState::Confirmed),
        ErrorCode::InvalidState
    );
    let now = Clock::get()?.unix_timestamp;
    require!(now < show.date, ErrorCode::SalesClosed);
    // Once the deadline has passed, an OnSale show is waiting for `check_threshold`
    // to confirm or cancel it; nobody may rescue it with late purchases.
    if show.state == ShowState::OnSale {
        require!(now < show.threshold_deadline, ErrorCode::SalesClosed);
    }
    require!(
        (1..=MAX_TICKETS_PER_PURCHASE).contains(&quantity),
        ErrorCode::InvalidQuantity
    );

    let new_sold = show
        .tickets_sold
        .checked_add(quantity as u32)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(new_sold <= show.capacity, ErrorCode::SoldOut);

    let amount = show
        .ticket_price_lamports
        .checked_mul(quantity as u64)
        .ok_or(ErrorCode::MathOverflow)?;

    let cpi_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.payer.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(anchor_lang::system_program::ID, cpi_accounts);
    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    show.tickets_sold = new_sold;
    show.escrow_lamports = show
        .escrow_lamports
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    let ticket = &mut ctx.accounts.ticket;
    ticket.show = show.key();
    ticket.buyer = beneficiary;
    ticket.payer = ctx.accounts.payer.key();
    ticket.quantity = quantity;
    ticket.amount_lamports = amount;
    ticket.purchased_at = now;
    ticket.refunded = false;
    ticket.bump = ctx.bumps.ticket;

    emit!(TicketBought {
        show: show.key(),
        ticket: ticket.key(),
        buyer: beneficiary,
        payer: ticket.payer,
        quantity,
        amount_lamports: amount,
        tickets_sold: new_sold,
        threshold_met: show.threshold_met(),
    });
    Ok(())
}
