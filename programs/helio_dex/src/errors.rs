use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
     #[msg("Provider has Insufficient Liquidity")]
     InsufficientLiquidityProvided,
     #[msg("Reserve does not have enough liquidity")]
     InsufficientLiquidityPresent,
     #[msg("Provider does not have enough liquidity tokens")]
     InsufficientLiquidityTokens,
     #[msg("Trader has insufficient token balance")]
     InsufficientTokenBalance,
     #[msg("Amount deposited cannot be zero")]
     DepositAmountIsZero,
     #[msg("Insufficient amount will be returned")]
     InsufficientReturnedAmount,
}