use anchor_lang::prelude::*;
use anchor_lang::{AccountDeserialize, AnchorDeserialize};
use anchor_spl::token::{self, TokenAccount, Transfer};

#[program]
mod auction {
    use super::*;

    pub fn create_auction(ctx: Context<CreateAuction>, start_price: u64) -> Result<()> {
        // init auction
        let auction = &mut ctx.accounts.auction;
        auction.ongoing = true;
        auction.seller = *ctx.accounts.seller.key;
        auction.item_holder = *ctx.accounts.item_holder.to_account_info().key;
        auction.currency_holder = *ctx.accounts.currency_holder.to_account_info().key;
        auction.bidder = *ctx.accounts.seller.key;
        auction.price = start_price;
        Ok(())
    }

    pub fn bid(ctx: Context<Bid>, price: u64) -> Result<()> {
        let auction = &mut ctx.accounts.auction;

        // check bid price
        if price <= auction.price {
            return Err(AuctionErr::BidPirceTooLow.into());
        }

        // if refund_receiver exist, return money back to it
        if auction.refund_receiver != Pubkey::default() {
            let (_, seed) =
                Pubkey::find_program_address(&[&auction.seller.to_bytes()], &ctx.program_id);
            let seeds = &[auction.seller.as_ref(), &[seed]];
            let signer = &[&seeds[..]];
            let cpi_accounts = Transfer {
                from: ctx.accounts.currency_holder.to_account_info().clone(),
                to: ctx.accounts.ori_refund_receiver.to_account_info().clone(),
                authority: ctx.accounts.currency_holder_auth.clone(),
            };
            let cpi_program = ctx.accounts.token_program.clone();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, auction.price)?;
        }

        // transfer bid pirce to custodial currency holder
        let cpi_accounts = Transfer {
            from: ctx.accounts.from.to_account_info().clone(),
            to: ctx.accounts.currency_holder.to_account_info().clone(),
            authority: ctx.accounts.from_auth.clone(),
        };
        let cpi_program = ctx.accounts.token_program.clone();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, price)?;

        // update auction info
        let auction = &mut ctx.accounts.auction;
        auction.bidder = *ctx.accounts.bidder.key;
        auction.refund_receiver = *ctx.accounts.from.to_account_info().key;
        auction.price = price;

        Ok(())
    }

    pub fn close_auction(ctx: Context<CloseAuction>) -> Result<()> {
        let auction = &mut ctx.accounts.auction;

        let (_, seed) =
            Pubkey::find_program_address(&[&auction.seller.to_bytes()], &ctx.program_id);
        let seeds = &[auction.seller.as_ref(), &[seed]];
        let signer = &[&seeds[..]];

        // item ownership transfer
        let cpi_accounts = Transfer {
            from: ctx.accounts.item_holder.to_account_info().clone(),
            to: ctx.accounts.item_receiver.to_account_info().clone(),
            authority: ctx.accounts.item_holder_auth.clone(),
        };
        let cpi_program = ctx.accounts.token_program.clone();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, ctx.accounts.item_holder.amount)?;

        // currency ownership transfer
        if ctx.accounts.currency_holder.amount >= auction.price {
            let cpi_accounts = Transfer {
                from: ctx.accounts.currency_holder.to_account_info().clone(),
                to: ctx.accounts.currency_receiver.to_account_info().clone(),
                authority: ctx.accounts.currency_holder_auth.clone(),
            };
            let cpi_program = ctx.accounts.token_program.clone();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, auction.price)?;
        }

        auction.ongoing = false;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateAuction<'info> {
    #[account(init)]
    auction: ProgramAccount<'info, Auction>,
    seller: AccountInfo<'info>,
    #[account("&item_holder.owner == &Pubkey::find_program_address(&[&seller.key.to_bytes()], &program_id).0")]
    item_holder: CpiAccount<'info, TokenAccount>,
    #[account("&currency_holder.owner == &Pubkey::find_program_address(&[&seller.key.to_bytes()], &program_id).0")]
    currency_holder: CpiAccount<'info, TokenAccount>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Bid<'info> {
    #[account(mut, "auction.ongoing")]
    auction: ProgramAccount<'info, Auction>,
    #[account(signer)]
    bidder: AccountInfo<'info>,
    #[account(
        mut,
        "from.mint == currency_holder.mint",
        "&from.owner == from_auth.key"
    )]
    from: CpiAccount<'info, TokenAccount>,
    #[account(signer)]
    from_auth: AccountInfo<'info>,
    #[account(
        mut,
        "currency_holder.to_account_info().key == &auction.currency_holder"
    )]
    currency_holder: CpiAccount<'info, TokenAccount>,
    #[account("&currency_holder.owner == currency_holder_auth.key")]
    currency_holder_auth: AccountInfo<'info>,
    #[account(mut, "ori_refund_receiver.key == &Pubkey::default() || ori_refund_receiver.key == &auction.refund_receiver")]
    ori_refund_receiver: AccountInfo<'info>,
    #[account("token_program.key == &token::ID")]
    token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CloseAuction<'info> {
    #[account(mut, "auction.ongoing")]
    auction: ProgramAccount<'info, Auction>,
    #[account(signer)]
    seller: AccountInfo<'info>,
    #[account(
        mut,
        "item_holder.to_account_info().key == &auction.item_holder"
        "&item_holder.owner == &Pubkey::find_program_address(&[&seller.key.to_bytes()], &program_id).0"
    )]
    item_holder: CpiAccount<'info, TokenAccount>,
    item_holder_auth: AccountInfo<'info>,
    #[account(mut, "item_receiver.owner == auction.bidder")]
    item_receiver: CpiAccount<'info, TokenAccount>,
    #[account(
        mut,
        "currency_holder.to_account_info().key == &auction.currency_holder"
        "&currency_holder.owner == &Pubkey::find_program_address(&[&seller.key.to_bytes()], &program_id).0"
    )]
    currency_holder: CpiAccount<'info, TokenAccount>,
    #[account("&currency_holder.owner == currency_holder_auth.key")]
    currency_holder_auth: AccountInfo<'info>,
    #[account(mut)]
    currency_receiver: CpiAccount<'info, TokenAccount>,
    #[account("token_program.key == &token::ID")]
    token_program: AccountInfo<'info>,
}

#[account]
pub struct Auction {
    ongoing: bool,
    seller: Pubkey,
    item_holder: Pubkey,
    currency_holder: Pubkey,
    bidder: Pubkey,
    refund_receiver: Pubkey,
    price: u64,
}

#[error]
pub enum AuctionErr {
    #[msg("your bid price is too low")]
    BidPirceTooLow,
}
