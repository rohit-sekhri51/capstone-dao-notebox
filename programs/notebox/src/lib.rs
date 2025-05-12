pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

//pub use crate::instructions::*;
// pub use instructions::create_post::CreatePost;
// pub use instructions::update_post::UpdatePost;
// pub use instructions::delete_post::DeletePost;
// pub use instructions::update_config::UpdateConfig;
use crate::state::Post;
use crate::state::Config;
// Removed invalid statement as it is not used or required.

pub use error::NoteBoxError;
pub const DAO_PROGRAM_ID: Pubkey = pubkey!("6f5HD6HfhDScH56N59mcGeDa44vCwdQF65JyZS668pJf");

declare_id!("2gkh4PKHmENrdnjNmb515KVbvpdWGsvbDtQ4qzC2FqrV");

#[program]
pub mod notebox {

    use super::*;
    //use crate::state::PostCategory;
    //use crate::instructions::__cpi_client_accounts_update_config;

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {

        msg!("Greetings from InitializeConfig Admin: {:?}", ctx.accounts.dao_signer.key());
        ctx.accounts.init_config()
    }

    pub fn create_post(ctx: Context<CreatePost>, category: String,
        title: String,
        content: String,
        rating: Option<u8>,
        location: Option<String>,
        timestamp: i64,
        expires_at: i64) -> Result<()> {

        ctx.accounts.create(category, title, content, rating, location, timestamp, expires_at, &ctx.bumps)
    }

    pub fn upd_post(ctx: Context<UpdatePost>, content: String, rating: Option<u8>, location: Option<String>) -> Result<()> {
        ctx.accounts.update(content, rating, location)
    }    
    
    pub fn del_post(ctx: Context<DeletePost>) -> Result<()> {
        ctx.accounts.delete()
    }
   
    pub fn update_config(ctx: Context<UpdateConfig>, allowed_categories: Option<Vec<String>>, max_post_length: Option<u32>, paused: Option<bool>) -> Result<()> {
        
        msg!("Greetings from UpdateConfig Admin: {:?}", ctx.accounts.dao_signer.key());

        let expected_signer = Pubkey::find_program_address(&[b"dao-authority"], &DAO_PROGRAM_ID).0;
        // let expected_bump = Pubkey::find_program_address(&[b"dao-authority"], &DAO_PROGRAM_ID).1;

        require_keys_eq!(ctx.accounts.dao_signer.key(), expected_signer, NoteBoxError::InvalidDaoSigner);
        // check b/w 2 program - dao_signer = admin = PDA

        // Optional: extra validation for admin match (redundant with has_one)
        require_keys_eq!(ctx.accounts.config.admin , ctx.accounts.dao_signer.key(),NoteBoxError::InvalidDaoSigner);   // check b/w internal notebox
        
        ctx.accounts.update_config_notebox(allowed_categories, max_post_length, paused)
    }
}

#[derive(Accounts)]
#[instruction(category: String, title: String)]
pub struct CreatePost<'info> {
    #[account(mut)]
    pub author: Signer<'info>,
    
    #[account(
        init,
        payer = author,
        space = 8 + Post::INIT_SPACE,
        seeds = [b"post", author.key().as_ref(), category.as_ref(), title.as_ref() ],    // &[category as u8]
        bump
    )]
    pub post: Account<'info, Post>,     // PDA

    #[account(
        mut,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,
    
    pub system_program: Program<'info, System>,
}

impl<'info> CreatePost<'info> {
    pub fn create(&mut self, category: String,
        title: String,
        content: String,
        rating: Option<u8>,
        location: Option<String>,
        timestamp: i64,
        expires_at: i64,
        bump: &CreatePostBumps) -> Result<()> {

        require!(content.len() <= self.config.max_post_length.unwrap_or(1000) as usize, NoteBoxError::ContentTooLong);
        require!(
            self.config.allowed_categories.as_ref().map_or(false, |allowed_categories| allowed_categories.contains(&category)),
            NoteBoxError::CategoryNotAllowed
        );

        //require!(self.post.rating.is_some() && self.post.rating.unwrap() >= 1 && self.post.rating.unwrap() <= 10, NoteBoxError::InvalidRating);
        match rating {
            Some(rating) => {
                require!(rating >= 1 && rating <= 10, NoteBoxError::InvalidRating);
            }
            None => { msg!("No rating was provided."); } // If rating is None, do nothing (no validation)
        }
        require!(content.len() <= 1000, NoteBoxError::ContentTooLong);
        require!(title.len() <= 20, NoteBoxError::TitleTooLong);
        require!(category.len() <= 15, NoteBoxError::CategoryTooLong);
        require!(location.as_ref().map(|l| l.len()).unwrap_or(0) <= 20, NoteBoxError::LocationTooLong);

        self.post.set_inner(Post {
            author: self.author.key(),
            category,
            title,
            content,
            rating,
            location,
            timestamp,
            expires_at,
            bump: bump.post,
        });
        Ok(())
    }
}


#[derive(Accounts)]
pub struct UpdatePost<'info> {
    #[account(
        mut,    // similar to has_one, but allows the author to update their own post
        constraint = author.key() == post.author @ NoteBoxError::Unauthorized   // same
    )]
    pub author: Signer<'info>,
    
    #[account(
        mut, 
        has_one = author,      // Ensure the author is the same as the post's author
        //has_one = post.category,   // Ensure the category is the same as the post's category
        //has_one = post.title,      // Ensure the title is the same as the post's title
        constraint = post.expires_at > Clock::get()?.unix_timestamp @ NoteBoxError::PostExpired,
        seeds = [b"post", author.key().as_ref(), post.category.as_ref() , post.title.as_ref()],    // &[post.category as u8]
        bump = post.bump
    )]
    pub post: Account<'info, Post>,
}   

impl<'info> UpdatePost<'info> {
    pub fn update(&mut self, content: String, rating: Option<u8>, location: Option<String>) -> Result<()> {

        // Only update content if provided
        self.post.content = content;
        
        // if rating is None, the existing rating will remain unchanged
        match rating {
            Some(new_rating) => self.post.rating = Some(new_rating),
            None => () // do nothing
        }
        
        // Only update location if provided
        if let Some(new_location) = location {
            self.post.location = Some(new_location);
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct DeletePost<'info> {
    #[account(
        mut,    // similar to has_one, but allows the author to delete their own post
        constraint = author.key() == post.author @ NoteBoxError::Unauthorized
    )]
    pub author: Signer<'info>,
    
    #[account(
        mut, 
        close= author,
        has_one = author,      // Ensure the author is the same as the post's author
        seeds = [b"post", author.key().as_ref(), post.category.as_ref() , post.title.as_ref()],        // &[post.category as u8]
        bump = post.bump
    )]
    pub post: Account<'info, Post>,
}  
impl<'info> DeletePost<'info> {
    pub fn delete(&mut self) -> Result<()> {
        // The post will be closed and the lamports will be sent to the author
        self.post.close(self.author.to_account_info())?;
        // Optionally, you can also set the post to None or do any other cleanup here
        // For example, if you want to set the post to None, you can do:
        // self.post = None;
        // But in this case, the account will be closed and removed from the blockchain
        // So, you don't need to do anything else here.
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>, // Wallet that funds the account

    #[account(
        init,
        payer = wallet,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    /// DAO signer PDA to be stored as admin (won't pay, just stored)
    /// CHECK: Safe, stored and verified explicitly  ???
    /// DAO signer passed from DAO program, used for auth check only
    /// CHECK: Verified manually, no seeds checked
    pub dao_signer: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeConfig<'info> {

    pub fn init_config(&mut self) -> Result<()> {

        // Set the admin to the PDA
        self.config.set_inner(Config { 
            admin: self.dao_signer.key(), 
            allowed_categories: Some(vec!["Hotel".to_string(),"Blog".to_string(),"URL".to_string()]), 
            max_post_length: Some(1000), 
            paused: Some(false) });

            // Check if the PDA is valid
        let expected_signer = Pubkey::find_program_address(&[b"dao-authority"], &DAO_PROGRAM_ID).0;
        require_keys_eq!(self.dao_signer.key(), expected_signer, NoteBoxError::InvalidDaoSigner);
        require_keys_eq!(self.config.admin, expected_signer, NoteBoxError::InvalidDaoSigner);
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    /// DAO signer PDA passed in explicitly
    /// CHECK: Verified via PDA + explicit require_keys_eq!
    // #[account(
    //     mut,
    //     seeds = [b"dao-authority"], 
    //     bump)] 
    pub dao_signer: UncheckedAccount<'info>,    // no seeds

    #[account(
        mut,
        // has_one = dao_signer @ NoteBoxError::InvalidConfigAdmin,  // Ensure the dao_signer is the same as the config's admin   
    )]  // Ensure the dao_signer is the same as the config's admin
    pub config: Account<'info, Config>,
}

impl<'info> UpdateConfig<'info> {

    pub fn update_config_notebox(&mut self, allowed_categories: Option<Vec<String>>, max_post_length: Option<u32>, 
        paused: Option<bool>) -> Result<()> {

        require!(max_post_length < Some(1000), NoteBoxError::MaxLengthTooLarge);  
        //require!(allowed_categories.len() <= 10, NoteBoxError::TooManyCategories);  

        // Append new categories (if not already in list)
        if let Some(allowed_categories) = allowed_categories {
            if let Some(existing) = &mut self.config.allowed_categories {
                for cat in allowed_categories {
                    if !existing.contains(&cat) {
                        existing.push(cat);
                    }
                }
            } else {
                self.config.allowed_categories = Some(allowed_categories);
            }
        }

        if let Some(new) = max_post_length {
            self.config.max_post_length = Some(new);
        }

        if let Some(new) = paused {
            self.config.paused = Some(new);
        }

        self.config.set_inner(Config { 
            admin: self.dao_signer.key(), 
            allowed_categories: self.config.allowed_categories.clone(), 
            max_post_length, 
            paused });
        
        Ok(())
    }
}