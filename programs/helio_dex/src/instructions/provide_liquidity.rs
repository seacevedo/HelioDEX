use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;

use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer, MintTo};
use integer_sqrt::IntegerSquareRoot;



#[derive(Accounts)]
pub struct ProvideLiquidity<'info> {
    pub provider: Signer<'info>,
    /// CHECK: Exchange Auth
    pub exchange_authority: AccountInfo<'info>,
    #[account(has_one = exchange_authority)]
    pub helio: Box<Account<'info, Helio>>,
    #[account(mut)]
    pub reserve_a: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub reserve_b: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_mint: Account<'info, Mint>,
    #[account(mut, constraint = provider_reserve_a.owner == provider.key())]
    pub provider_reserve_a: Account<'info, TokenAccount>,
    #[account(mut, constraint = provider_reserve_b.owner == provider.key())]
    pub provider_reserve_b: Account<'info, TokenAccount>, 
    #[account(mut, constraint = provider_pool_reserve.owner == provider.key())]
    pub provider_pool_reserve: Account<'info, TokenAccount>, 
    #[account(
        has_one = reserve_a, 
        has_one = reserve_b, 
        has_one = pool_mint
    )]
    pub pool_state: Box<Account<'info, PoolState>>,
    pub token_program: Program<'info, Token>
}

impl<'info> ProvideLiquidity<'info> { 

    fn transfer_to_reserve_a_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.provider_reserve_a.to_account_info(),
                to: self.reserve_a.to_account_info(),
                authority: self.provider.to_account_info(),
            }
        )
   }

    fn transfer_to_reserve_b_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.provider_reserve_b.to_account_info(),
                to: self.reserve_b.to_account_info(),
                authority: self.provider.to_account_info(),
            }
        )
   }

   fn pool_liq_mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            MintTo {
                mint: self.pool_mint.to_account_info(),
                to: self.provider_pool_reserve.to_account_info(),
                authority: self.exchange_authority.to_account_info()
            }
        )
   }


   


}

// provides liquidity to an existing pool: makes sure user has enough tokens, then transfers the tokens to the pool and mints appropritate pool liquidity tokens proportional to the amount provided
pub fn handler(ctx: Context<ProvideLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {

    let provider_amt_a = ctx.accounts.provider_reserve_a.amount;
    let provider_amt_b = ctx.accounts.provider_reserve_b.amount;

    require!(amount_a < provider_amt_a, ErrorCode::InsufficientLiquidityProvided);
    require!(amount_b < provider_amt_b, ErrorCode::InsufficientLiquidityProvided);

    let reserve_amt_a = ctx.accounts.reserve_a.amount;
    let reserve_amt_b = ctx.accounts.reserve_b.amount;
    let pool_liq_amt = ctx.accounts.pool_mint.supply;

    let liq_amt_mint;
    let optimum_dep_a = amount_a;
    let optimum_dep_b;


    if reserve_amt_a == 0 && reserve_amt_b == 0 {
        let liq_product = amount_a.checked_mul(amount_b).unwrap();
        liq_amt_mint = liq_product.integer_sqrt();
        optimum_dep_b = amount_b; 
    } else {
        liq_amt_mint = optimum_dep_a.checked_mul(pool_liq_amt).unwrap().checked_div(reserve_amt_a).unwrap();
        optimum_dep_b = reserve_amt_b.checked_mul(amount_a).unwrap().checked_div(reserve_amt_a).unwrap();

        require!(optimum_dep_a <= amount_a, ErrorCode::InsufficientLiquidityProvided);
        require!(optimum_dep_b <= amount_b, ErrorCode::InsufficientLiquidityProvided);
    }

    
    let pda_bump = ctx.accounts.helio.exchange_auth_bump;
    let pda_seeds = &[b"exchange_authority".as_ref(), ctx.accounts.helio.owner.as_ref(), &[pda_bump]];

    token::mint_to(ctx.accounts.pool_liq_mint_ctx().with_signer(&[pda_seeds]), liq_amt_mint)?;
    token::transfer(ctx.accounts.transfer_to_reserve_a_ctx().with_signer(&[pda_seeds]), optimum_dep_a)?;
    token::transfer(ctx.accounts.transfer_to_reserve_b_ctx().with_signer(&[pda_seeds]), optimum_dep_b)?;



    Ok(())
}