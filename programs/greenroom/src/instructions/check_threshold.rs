use anchor_lang::prelude::*;

use crate::{
    error::ErrorCode,
    events::{ShowCancelled, ShowConfirmed},
    state::{Show, ShowState},
};

/// Permissionless crank: anyone may call it; the outcome depends only on the
/// stored deal terms and the clock.
#[derive(Accounts)]
pub struct CheckThreshold<'info> {
    #[account(mut)]
    pub show: Account<'info, Show>,
}

pub fn handle_check_threshold(ctx: Context<CheckThreshold>) -> Result<()> {
    let show = &mut ctx.accounts.show;
    require!(show.state == ShowState::OnSale, ErrorCode::InvalidState);

    if show.threshold_met() {
        show.state = ShowState::Confirmed;
        emit!(ShowConfirmed {
            show: show.key(),
            tickets_sold: show.tickets_sold,
            capacity: show.capacity,
        });
        return Ok(());
    }

    let now = Clock::get()?.unix_timestamp;
    require!(now >= show.threshold_deadline, ErrorCode::TooEarly);
    show.state = ShowState::Cancelled;
    emit!(ShowCancelled {
        show: show.key(),
        tickets_sold: show.tickets_sold,
        tickets_required: show.tickets_required(),
    });
    Ok(())
}
