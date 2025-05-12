use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    /// Allowed categories for posts
    #[max_len(3 ,20)]
    pub allowed_categories: Option<Vec<String>>,
    pub max_post_length: Option<u32>,
    pub paused: Option<bool>,
    //pub auto_expires_at: Option<i64>,
}