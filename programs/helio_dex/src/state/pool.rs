use anchor_lang::prelude::*;

#[account]
pub struct PoolState {
    pub reserve_a: Pubkey,
    pub reserve_b: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub pool_mint: Pubkey,
    pub fee_reserve: Pubkey,
    pub protocol_tip_num: u64,
    pub protocol_tip_denom: u64,
    pub amount_minted: u64
}


impl PoolState {
    pub const LEN: usize = 8 + 32*7 + 8*3; 
}
