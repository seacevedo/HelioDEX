use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use crate::state::*;

#[derive(Accounts)]
pub struct InitializeHelio<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = Helio::LEN)]
    pub helio: Account<'info, Helio>,
    /// CHECK: Exchange authority PDA has control over exchange
    #[account(
        seeds = [
            b"exchange_authority".as_ref(),
            owner.key().as_ref()
        ],
        bump,
    )]
    pub exchange_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

//Initializes the market account
pub fn handler(ctx: Context<InitializeHelio>, lp_reward_num: u64, lp_reward_denom: u64) -> Result<()> {
    let helio = &mut ctx.accounts.helio;

    helio.exchange_authority = ctx.accounts.exchange_authority.key();
    helio.owner = ctx.accounts.owner.key();
    helio.lp_reward_num = lp_reward_num;
    helio.lp_reward_denom = lp_reward_denom;
    
    helio.exchange_auth_bump = *ctx.bumps.get("exchange_authority").unwrap();

    Ok(())
}