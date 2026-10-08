use anchor_lang::prelude::*;

use crate::{
    error::ErrorCode,
    events::ShowAccepted,
    state::{Show, ShowState},
};

#[derive(Accounts)]
pub struct AcceptShow<'info> {
    pub venue_authority: Signer<'info>,
    #[account(mut, has_one = venue_authority @ ErrorCode::Unauthorized)]
    pub show: Account<'info, Show>,
}

pub fn handle_accept_show(ctx: Context<AcceptShow>) -> Result<()> {
    let show = &mut ctx.accounts.show;
    require!(show.state == ShowState::Proposed, ErrorCode::InvalidState);
    show.state = ShowState::OnSale;

    emit!(ShowAccepted {
        show: show.key(),
        venue_authority: ctx.accounts.venue_authority.key(),
    });
    Ok(())
}
