use anchor_lang::prelude::*;

#[error_code]
pub enum NoteBoxError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("Invalid DAO signer.")]
    InvalidDaoSigner,
    #[msg("Invalid Config Admin.")]
    InvalidConfigAdmin,
    #[msg("Post has expired.")]
    PostExpired,

    #[msg("Rating is allowed b/w 1 and 10.")]
    InvalidRating,
    #[msg("Invaid Post Content > 1000.")]
    ContentTooLong,
    #[msg("Invalid Title > 20.")]
    TitleTooLong,

    #[msg("Invalid Category > 15.")]
    CategoryTooLong,
    #[msg("Invalid Category > 20.")]
    LocationTooLong,
    #[msg("Unable to set content in Config.")]
    MaxLengthTooLarge,
    #[msg("Unable to set category in Config allowed category.")]
    CategoryNotAllowed
}
