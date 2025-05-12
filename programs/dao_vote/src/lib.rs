pub mod error;
pub mod state;
pub mod instructions;

use anchor_lang::prelude::*;

//use notebox::cpi::accounts::UpdateConfig;
use crate::state::{Proposal, VoteRecord};
use crate::error::DaoError;

declare_id!("6f5HD6HfhDScH56N59mcGeDa44vCwdQF65JyZS668pJf");

#[program]
pub mod dao_vote {
    use super::*;

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
        deadline: i64,
        ) -> Result<()> {

        require!(deadline > Clock::get()?.unix_timestamp, DaoError::InvalidDeadline);  

        ctx.accounts.create(title, description, deadline, ctx.bumps)
    }

    pub fn vote_proposal(ctx: Context<VoteProposal>, voted_yes: bool) -> Result<()> {
        ctx.accounts.vote(voted_yes)
    }
    // pub fn close_proposal(ctx: Context<CloseProposal>) -> Result<()> {
    //     ctx.accounts.close_proposal()
    // }

    pub fn close_proposal(
        ctx: Context<CloseProposal>,
        allowed_categories: Option<Vec<String>>,
        max_post_length: Option<u32>,
        paused: Option<bool>,       // bump: CloseProposalBumps, error "trait bound `CloseProposalBumps: BorshDeserialize` was not satisfied"
        dao_bump: u8,
        ) -> Result<()> {

        // ctx.accounts.close_proposal()
        ctx.accounts.close_with_cpi(allowed_categories, max_post_length, paused, dao_bump)
        
    }
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,

    #[account(
        init, 
        payer = proposer, 
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", proposer.key().as_ref(), title.as_ref()], 
        bump)]
    pub proposal: Account<'info, Proposal>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreateProposal<'info> {

    pub fn create(&mut self, title: String, description: String, deadline: i64, bump: CreateProposalBumps) -> Result<()> {

        self.proposal.set_inner(Proposal {
            proposer: self.proposer.key(),
            title,
            description,
            yes_votes: 0,
            no_votes: 0,
            deadline,
            executed: false,
            bump: bump.proposal,
        });

        Ok(())
    }
    
}

#[derive(Accounts)]
pub struct VoteProposal<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        constraint = proposal.proposer != voter.key() @ DaoError::CannotVoteOnOwnProposal,
        constraint = proposal.deadline > clock.unix_timestamp @ DaoError::ProposalExpired,
        constraint = !proposal.executed @ DaoError::AlreadyExecuted,
        seeds = [b"proposal", proposal.proposer.as_ref(), proposal.title.as_ref()], 
        bump = proposal.bump,)]
    pub proposal: Account<'info, Proposal>,

    #[account(
        init, 
        payer = voter, 
        constraint = vote_record.proposal != proposal.key() @ DaoError::InvalidVote,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote", proposal.key().as_ref(), voter.key().as_ref()], 
        bump)]
    pub vote_record: Account<'info, VoteRecord>,
    
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

impl<'info> VoteProposal<'info> {

    pub fn vote(&mut self, voted_yes: bool) -> Result<()> { 

        // Check if the voter has already voted
        if self.vote_record.voter == self.voter.key() {
            return Err(DaoError::AlreadyVoted.into());
        }
        // Check if the proposal has expired
        if self.proposal.deadline <= self.clock.unix_timestamp {
            return Err(DaoError::ProposalExpired.into());
        }
        // Check if the proposal has already been executed
        if self.proposal.executed {
            return Err(DaoError::AlreadyExecuted.into());
        }
        // Check if the voter is the proposer
        if self.proposal.proposer == self.voter.key() {
            return Err(DaoError::CannotVoteOnOwnProposal.into());
        }
        // Check if the vote record is valid
        if self.vote_record.proposal == self.proposal.key() {
            return Err(DaoError::InvalidVote.into());
        }
        

        self.vote_record.set_inner(VoteRecord {
            proposal: self.proposal.key(),
            voter: self.voter.key(),
            voted_yes,
        });

        if voted_yes {
            self.proposal.yes_votes += 1;
        } else {
            self.proposal.no_votes += 1;
        }

        Ok(())
    }
    
}


#[derive(Accounts)]
pub struct CloseProposal<'info> {
    /// CHECK: This is a PDA derived from known seed [\"dao-authority\"] and DAO program ID. Verified in handler.
    #[account(
        mut,
        seeds = [b"dao-authority"], 
        bump)]
    pub dao_signer: UncheckedAccount<'info>,

    #[account(
        mut)]
    pub proposal: Account<'info, Proposal>,
    pub clock: Sysvar<'info, Clock>,

    // For CPI
    #[account(
        mut)]
    pub notebox_config: Account<'info, notebox::state::Config>,
    pub notebox_program: Program<'info, notebox::program::Notebox>,
    pub system_program: Program<'info, System>,
}

impl<'info> CloseProposal<'info> {
    // pub fn close_proposal(&mut self) -> Result<()> {

    //     require!(self.clock.unix_timestamp >= self.proposal.deadline, DaoError::VotingStillOpen);
    //     require!(!self.proposal.executed, DaoError::AlreadyExecuted);

    //     // Set the proposal as executed
    //     self.proposal.executed = true;
    //     Ok(())
    // }
    pub fn close_with_cpi(&mut self,
        allowed_categories: Option<Vec<String>>,
        max_post_length: Option<u32>,
        paused: Option<bool>,   // bump: CloseProposalBumps,
        dao_bump: u8,
    ) -> Result<()> {

        //require!(Clock::get()?.unix_timestamp > self.proposal.deadline, DaoError::VotingStillOpen);
        require!(!self.proposal.executed, DaoError::AlreadyExecuted);
        require!(self.proposal.yes_votes + self.proposal.no_votes > 0, DaoError::NoVotes);

        if self.proposal.yes_votes > self.proposal.no_votes {
            // If the proposal passed, update the Notebox config
            msg!("Proposal passed. Updating Notebox config...");
        } else {
            // If the proposal failed, do nothing
            msg!("Proposal failed. No changes made to Notebox config.");
            return Ok(());
        }
        self.proposal.executed = true;

        let cpi_program = self.notebox_program.to_account_info();
        let cpi_accounts = notebox::cpi::accounts::UpdateConfig {
            config: self.notebox_config.to_account_info(),
            dao_signer: self.dao_signer.to_account_info(),
        };
        
        // let bump = self.dao_signer
        //     .to_account_info()
        //     .key
        //     .as_ref()
        //     .get(0)
        //     .ok_or(DaoError::InvalidSignerBump)?;
        // let bump: u8 = *bump;
        // msg!("Signer bump: {}", bump);
        // msg!("Signer PDA: {:?}", self.dao_signer.key());
        
        let signer_seeds: &[&[&[u8]]] = &[&[b"dao-authority", &[dao_bump]]];
        msg!("Signer seeds: {:?}", signer_seeds);

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        notebox::cpi::update_config(cpi_ctx, allowed_categories, max_post_length, paused)?; 
        // Ensure update_config is exposed

        Ok(())
    }
    
}