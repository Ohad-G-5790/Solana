use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The signer is not the authority for this account")]
    Unauthorized,
    #[msg("The show is not in a state that allows this action")]
    InvalidState,
    #[msg("Too early: the threshold deadline or show date has not passed yet")]
    TooEarly,
    #[msg("Ticket sales are closed for this show")]
    SalesClosed,
    #[msg("Not enough capacity left for this purchase")]
    SoldOut,
    #[msg("Quantity must be between 1 and MAX_TICKETS_PER_PURCHASE")]
    InvalidQuantity,
    #[msg("Payout split must sum to 10000 bps and every part must be positive")]
    InvalidSplit,
    #[msg("Threshold must be between 1 and 10000 bps")]
    InvalidThreshold,
    #[msg("Dates are inconsistent (show outside tour window or deadline after show)")]
    InvalidDates,
    #[msg("Requested capacity exceeds the venue capacity")]
    CapacityExceedsVenue,
    #[msg("Ticket price must be greater than zero")]
    InvalidPrice,
    #[msg("This ticket was already refunded")]
    AlreadyRefunded,
    #[msg("The show already has the maximum number of payees")]
    TooManyPayees,
    #[msg("Payee accounts passed for settlement do not match the stored payees")]
    PayeeMismatch,
    #[msg("This address is already a payee on the show")]
    DuplicatePayee,
    #[msg("A text field is empty or longer than allowed")]
    TextLength,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Tour id must equal the band's next sequential tour number")]
    WrongTourId,
    #[msg("Capacity must be greater than zero")]
    InvalidCapacity,
}
