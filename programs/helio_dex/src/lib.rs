use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod helio_dex {
    use super::*;

    pub fn initialize_market(ctx: Context<InitializeHelio>,  lp_reward_fee: u64, helio_trading_fee: u64) -> Result<()> {
        instructions::init_helio::handler(ctx, lp_reward_fee, helio_trading_fee)?;
        Ok(())
    }

    pub fn initialize_pool(ctx: Context<InitializePool>, protocol_tip_num: u64, protocol_tip_denom: u64) -> Result<()> {
        instructions::init_pool::handler(ctx, protocol_tip_num, protocol_tip_denom)?;
        Ok(())
    }

    pub fn provide_liquidity(ctx: Context<ProvideLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
        instructions::provide_liquidity::handler(ctx, amount_a, amount_b)?;
        Ok(())
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, liq_amt_burn: u64) -> Result<()> {
        instructions::remove_liquidity::handler(ctx, liq_amt_burn)?;
        Ok(())
    }

    pub fn swap(ctx: Context<Swap>, amount_in: u64) -> Result<()> {
        instructions::swap::handler(ctx, amount_in)?;
        Ok(())
    }
}
