use anchor_lang::prelude::*;

#[account]
pub struct Helio {
    pub exchange_authority: Pubkey, // 32
    pub owner: Pubkey, // 32
    pub lp_reward_num: u64, // 8
    pub lp_reward_denom: u64, // 8
    pub exchange_auth_bump: u8 // 1
}


impl Helio {
    pub const LEN: usize = 8 + 32*2 + 8*2 + 1; 
}
