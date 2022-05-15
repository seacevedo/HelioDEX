use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;

use anchor_spl::token::{self, Token, TokenAccount, Transfer};



#[derive(Accounts)]
pub struct Swap<'info> {
    pub trader: Signer<'info>,
    #[account(mut)]
    pub reserve_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reserve_b: Account<'info, TokenAccount>,
    #[account(mut, constraint = trader_reserve_a.owner == trader.key())]
    pub trader_reserve_a: Account<'info, TokenAccount>,
    #[account(mut, constraint = trader_reserve_b.owner == trader.key())]
    pub trader_reserve_b: Account<'info, TokenAccount>,
    /// CHECK: Exchange auth
    pub exchange_authority: AccountInfo<'info>,
    #[account(has_one = exchange_authority)]
    pub helio: Account<'info, Helio>,
    #[account(
        has_one = reserve_a, 
        has_one = reserve_b
    )]
    pub pool_state: Box<Account<'info, PoolState>>,
    pub token_program: Program<'info, Token>
}

impl<'info> Swap<'info> { 

    fn transfer_to_reserve_a_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.trader_reserve_a.to_account_info(),
                to: self.reserve_a.to_account_info(),
                authority: self.trader.to_account_info(),
            }
        )
    }

    fn transfer_to_trader_b_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.reserve_b.to_account_info(),
                to: self.trader_reserve_b.to_account_info(),
                authority: self.exchange_authority.to_account_info(),
            }
        )
    }


}

// constant product calculation

pub fn calculate_amt_out(amount_in: u64, liquidity_fee_num: u64, liquidity_fee_denom: u64, reserve_amt_a: u64, reserve_amt_b: u64) -> u64 {
    let delta_a = liquidity_fee_num.checked_mul(amount_in).unwrap().checked_div(liquidity_fee_denom).unwrap();
    let numerator = reserve_amt_b.checked_mul(delta_a).unwrap();
    let denominator = reserve_amt_a.checked_add(delta_a).unwrap();
    numerator.checked_div(denominator).unwrap()
}

 
// swap tokens based using constant product AMM
pub fn handler(ctx: Context<Swap>, amount_in: u64) -> Result<()> {

    let trader_reserve_a_amt = ctx.accounts.trader_reserve_a.amount;
    let reserve_amt_a = ctx.accounts.reserve_a.amount;
    let reserve_amt_b = ctx.accounts.reserve_b.amount;
    let liquidity_fee_num = ctx.accounts.helio.lp_reward_num;
    let liquidity_fee_denom = ctx.accounts.helio.lp_reward_denom;

    require!(amount_in > 0, ErrorCode::DepositAmountIsZero);
    require!(amount_in <= trader_reserve_a_amt, ErrorCode::InsufficientTokenBalance);
    
    let amount_out = calculate_amt_out(amount_in, liquidity_fee_num, liquidity_fee_denom, reserve_amt_a, reserve_amt_b);

    require!(amount_out <= reserve_amt_b, ErrorCode::InsufficientLiquidityPresent);

    let pda_bump = ctx.accounts.helio.exchange_auth_bump;
    let pda_seeds = &[b"exchange_authority".as_ref(), ctx.accounts.helio.owner.as_ref(), &[pda_bump]];

    token::transfer(ctx.accounts.transfer_to_reserve_a_ctx().with_signer(&[pda_seeds]), amount_in)?;
    token::transfer(ctx.accounts.transfer_to_trader_b_ctx().with_signer(&[pda_seeds]), amount_out)?;



    Ok(())
}