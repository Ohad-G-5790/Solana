/**
 * The platform fee: Greenroom takes 10% of every show's ticket money, paid at
 * settlement like any other payee (the program's add_payee takes it out of the
 * band's share). Cancelled shows refund every fan in full, so the fee is only
 * ever paid on shows that are played. Pure: the dashboard imports it.
 *
 * The receiving wallet is configuration, never a code default: runs name it
 * with --platform-wallet (or GREENROOM_PLATFORM_WALLET), the dashboard build
 * with NEXT_PUBLIC_PLATFORM_WALLET. Without one, shows are booked without fee.
 */
export const PLATFORM_FEE_BPS = 1000;
export const PLATFORM_LABEL = "Greenroom fee";
