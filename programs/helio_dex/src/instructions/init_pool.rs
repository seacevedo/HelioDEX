use anchor_lang::prelude::*;
use crate::state::*;
use anchor_spl::token::{Token, Mint, TokenAccount};


#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, payer = payer, space = PoolState::LEN)]
    pub pool_state: Box<Account<'info, PoolState>>,
    /// CHECK: Exchange auth
    pub exchange_authority: AccountInfo<'info>,
    #[account(init, payer = payer,
        seeds = [
            b"reserve_a".as_ref(),
            pool_state.key().as_ref()
        ],
        bump,
        token::mint = mint_a, token::authority = exchange_authority
    )]
    pub reserve_a: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = payer,
        seeds = [
            b"reserve_b".as_ref(),
            pool_state.key().as_ref()
        ],
        bump,
        token::mint = mint_b, token::authority = exchange_authority
    )]
    pub reserve_b: Account<'info, TokenAccount>,
    #[account(init, payer = payer,
        seeds = [
            b"fee_reserve".as_ref(),
            pool_state.key().as_ref()
        ],
        bump,
        token::mint = pool_mint, token::authority = exchange_authority
    )]
    pub fee_reserve: Account<'info, TokenAccount>,
    pub mint_a: Account<'info, Mint>,
    pub mint_b: Account<'info, Mint>,
    pub pool_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

 //Initializes a new pool
pub fn handler(ctx: Context<InitializePool>, protocol_tip_num: u64, protocol_tip_denom: u64) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;

    pool_state.reserve_a = ctx.accounts.reserve_a.key();
    pool_state.reserve_b = ctx.accounts.reserve_b.key();
    pool_state.mint_a = ctx.accounts.mint_a.key();
    pool_state.mint_b = ctx.accounts.mint_b.key();
    pool_state.pool_mint = ctx.accounts.pool_mint.key();
    pool_state.fee_reserve = ctx.accounts.fee_reserve.key();
    pool_state.protocol_tip_num = protocol_tip_num;
    pool_state.protocol_tip_denom = protocol_tip_denom;
    pool_state.amount_minted = 0;

    Ok(())
}