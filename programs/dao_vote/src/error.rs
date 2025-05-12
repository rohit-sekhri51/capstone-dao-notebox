use anchor_lang::prelude::*;

#[error_code]
pub enum DaoError {
    #[msg("Voting period has ended.")]
    VotingClosed,
    #[msg("Voting period is still active.")]
    VotingStillOpen,
    #[msg("Proposal already executed.")]
    AlreadyExecuted,

    #[msg("Proposal deadline expired.")]
    ProposalExpired,
    #[msg("Proposal not executed yet.")]
    NotExecuted,
    #[msg("Proposal not found.")]
    ProposalNotFound,
    #[msg("Invalid proposal.")]
    InvalidProposal,

    #[msg("Invalid vote.")]
    InvalidVote,
    #[msg("Invalid vote type.")]
    InvalidVoteType,
    #[msg("Proposal Onwer is not allowed to vote.")]
    CannotVoteOnOwnProposal,
    #[msg("Already voted.")]
    AlreadyVoted,
    #[msg("No votes.")]
    NoVotes,

    #[msg("Invalid Signer Bump")]
    InvalidSignerBump,
    #[msg("Deadline is in the past.")]
    InvalidDeadline
}