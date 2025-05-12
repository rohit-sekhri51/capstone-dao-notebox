use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PostCategory {
    Tweet,
    Blog,
    CafeReview,
    Notes,      // notes
    Url,
}

#[account]
#[derive(InitSpace)]
pub struct Post {
    pub author: Pubkey,
    #[max_len(15)]
    pub category: String,        //PostCategory, // tags
    #[max_len(20)]
    pub title: String,         // title of the post
    #[max_len(1000)]
    pub content: String,        // describe the post
    pub rating: Option<u8>,      // rating of post should be b/w 1 to 10
    #[max_len(20)]
    pub location: Option<String>, 
    pub timestamp: i64,       // Clock::get()?.unix_timestamp
    pub expires_at: i64, // timestamp of when the post expires
    pub bump: u8,
    //pub author_name: String,    // required or not on blockchain, can be fetched from client
}