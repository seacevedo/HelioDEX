use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;

use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer, Burn};

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    pub provider: Signer<'info>,
    /// CHECK: Exchange auth
    pub exchange_authority: AccountInfo<'info>,
    #[account(has_one = exchange_authority)]
    pub helio: Box<Account<'info, Helio>>,
    #[account(mut)]
    pub reserve_a: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub reserve_b: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub fee_reserve: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_mint: Account<'info, Mint>,
    #[account(mut, constraint = provider_reserve_a.owner == provider.key())]
    pub provider_reserve_a: Account<'info, TokenAccount>,
    #[account(mut, constraint = provider_reserve_b.owner == provider.key())]
    pub provider_reserve_b: Account<'info, TokenAccount>, 
    #[account(mut, constraint = provider_pool_reserve.owner == provider.key())]
    pub provider_pool_reserve: Account<'info, TokenAccount>, 
    #[account(has_one = reserve_a, has_one = reserve_b, has_one = fee_reserve, has_one = pool_mint)]
    pub pool_state: Box<Account<'info, PoolState>>,
    pub token_program: Program<'info, Token>
}

impl<'info> RemoveLiquidity<'info> { 

    fn transfer_to_provider_a_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_a.to_account_info(),
                to: self.provider_reserve_a.to_account_info(),
                authority: self.exchange_authority.to_account_info(),
            }
        )
   }

    fn transfer_to_provider_b_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_b.to_account_info(),
                to: self.provider_reserve_b.to_account_info(),
                authority: self.exchange_authority.to_account_info(),
            }
        )
   }

   fn transfer_tip_protocol(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.provider_pool_reserve.to_account_info(),
                to: self.fee_reserve.to_account_info(),
                authority: self.provider.to_account_info(),
            }
        )
   }


   fn pool_liq_burn_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Burn {
                mint: self.pool_mint.to_account_info(),
                to: self.provider_pool_reserve.to_account_info(),
                authority: self.provider.to_account_info()
            }
        )
   }

}

// User can remove liquidity based on the amount of liquidity tokens they possess

pub fn handler(ctx: Context<RemoveLiquidity>, liq_amt_burn: u64) -> Result<()> { 

    let reserve_amt_a = ctx.accounts.reserve_a.amount;
    let reserve_amt_b = ctx.accounts.reserve_b.amount;
    let provider_amt_liq = ctx.accounts.provider_pool_reserve.amount;
    let pool_amt_minted = ctx.accounts.pool_mint.supply;
    let protocol_tip_num = ctx.accounts.pool_state.protocol_tip_num;
    let protocol_tip_denom = ctx.accounts.pool_state.protocol_tip_denom;

    require!(liq_amt_burn <= provider_amt_liq, ErrorCode::InsufficientLiquidityTokens);

    // Leave tip to protocol
    let protocol_liq_tip = liq_amt_burn.checked_mul(protocol_tip_num).unwrap().checked_div(protocol_tip_denom).unwrap();
    let adj_liq_burn = liq_amt_burn.checked_sub(protocol_liq_tip).unwrap();

    let ret_amt_a = adj_liq_burn.checked_mul(reserve_amt_a).unwrap().checked_div(pool_amt_minted).unwrap();
    let ret_amt_b = adj_liq_burn.checked_mul(reserve_amt_b).unwrap().checked_div(pool_amt_minted).unwrap();


    let pda_bump = ctx.accounts.helio.exchange_auth_bump;
    let pda_seeds = &[b"exchange_authority".as_ref(), ctx.accounts.helio.owner.as_ref(), &[pda_bump]];

    token::burn(ctx.accounts.pool_liq_burn_ctx().with_signer(&[pda_seeds]), adj_liq_burn)?; // 1600000000
    token::transfer(ctx.accounts.transfer_tip_protocol().with_signer(&[pda_seeds]), protocol_liq_tip)?; // 400000000
    token::transfer(ctx.accounts.transfer_to_provider_a_ctx().with_signer(&[pda_seeds]), ret_amt_a)?; // 1600000000
    token::transfer(ctx.accounts.transfer_to_provider_b_ctx().with_signer(&[pda_seeds]), ret_amt_b)?; // 1600000000

    //let pool_state = &mut ctx.accounts.pool;
    //pool_state.amount_minted -= provider_amt_liq;

    Ok(())

}