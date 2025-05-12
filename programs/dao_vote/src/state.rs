use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub proposer: Pubkey,
    #[max_len(15)]
    pub title: String,
    #[max_len(50)]
    pub description: String,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub deadline: i64,
    pub executed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub voted_yes: bool,
}