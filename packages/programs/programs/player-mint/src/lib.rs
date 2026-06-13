use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("D9xiskVonYcZs3zMnjeKS9HY27s2fcBxTD3Jw5op2XoY");

/// Gaffer individual player NFTs — Solana/Anchor port of `PlayerMint.sol`.
///
/// Owner seeds an on-chain catalog of players (price in USDC + scarcity); anyone
/// can mint any catalogued player by paying its USDC price. Payment lands in a
/// program-owned vault token account; the owner withdraws it. Minted players are
/// program-owned PDA accounts (no Metaplex) keyed by a global token id.
///
///   MintConfig   ["config"]                 (owner, usdc_mint, next_token_id)
///   vault        ["vault"]                   (USDC token account, self-authority)
///   Catalog      ["catalog", player_id]      (price/scarcity per player)
///   PlayerToken  ["token", token_id]         (a minted player)
#[program]
pub mod player_mint {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.owner = ctx.accounts.owner.key();
        cfg.usdc_mint = ctx.accounts.usdc_mint.key();
        cfg.next_token_id = 1;
        cfg.bump = ctx.bumps.config;
        cfg.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    /// Create or update one catalog entry. Owner-only. Re-setting an existing
    /// entry preserves its `minted` count (only price/scarcity metadata changes).
    pub fn set_catalog_entry(
        ctx: Context<SetCatalogEntry>,
        player_id: String,
        position: u8,
        rating: u16,
        is_legend: bool,
        price: u64,
        supply_cap: u32,
    ) -> Result<()> {
        require!(player_id.len() <= 32, MintError::PlayerIdTooLong);
        let m = &mut ctx.accounts.catalog;
        m.position = position;
        m.rating = rating;
        m.is_legend = is_legend;
        m.price = price;
        m.max_supply = supply_cap;
        m.exists = true;
        m.bump = ctx.bumps.catalog;
        emit!(CatalogSet {
            player_id,
            price,
            max_supply: supply_cap,
        });
        Ok(())
    }

    /// Mint a catalogued player. Buyer pays `price` USDC into the vault.
    /// `token_id` must equal the current `next_token_id` (it seeds the token PDA).
    pub fn mint_player(ctx: Context<MintPlayer>, token_id: u64, player_id: String) -> Result<()> {
        require!(player_id.len() <= 32, MintError::PlayerIdTooLong);
        let cfg = &mut ctx.accounts.config;
        require!(token_id == cfg.next_token_id, MintError::WrongTokenId);

        let m = &mut ctx.accounts.catalog;
        require!(m.exists, MintError::NotInCatalog);
        require!(m.minted < m.max_supply, MintError::SoldOut);

        // Pull USDC from the buyer into the vault.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_usdc.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            m.price,
        )?;

        m.minted += 1;
        cfg.next_token_id += 1;

        let t = &mut ctx.accounts.player_token;
        t.owner = ctx.accounts.buyer.key();
        t.token_id = token_id;
        t.player_id = player_id.clone();
        t.position = m.position;
        t.rating = m.rating;
        t.is_legend = m.is_legend;
        t.minted_at = Clock::get()?.unix_timestamp;
        t.bump = ctx.bumps.player_token;

        emit!(PlayerMinted {
            buyer: t.owner,
            player_id,
            token_id,
            paid: m.price,
        });
        Ok(())
    }

    /// Owner withdraws `amount` USDC from the vault to a destination token account.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let bump = ctx.accounts.config.vault_bump;
        let seeds: &[&[u8]] = &[b"vault", &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;
        Ok(())
    }
}

// ──────────────────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct MintConfig {
    pub owner: Pubkey,
    pub usdc_mint: Pubkey,
    pub next_token_id: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Catalog {
    pub position: u8,
    pub rating: u16,
    pub is_legend: bool,
    pub price: u64,
    pub max_supply: u32,
    pub minted: u32,
    pub exists: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerToken {
    pub owner: Pubkey,
    pub token_id: u64,
    #[max_len(32)]
    pub player_id: String,
    pub position: u8,
    pub rating: u16,
    pub is_legend: bool,
    pub minted_at: i64,
    pub bump: u8,
}

// ──────────────────────────────────────────────────────────────────────────
// Accounts
// ──────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + MintConfig::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, MintConfig>,
    #[account(
        init,
        payer = owner,
        seeds = [b"vault"],
        bump,
        token::mint = usdc_mint,
        token::authority = vault
    )]
    pub vault: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(player_id: String)]
pub struct SetCatalogEntry<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = owner)]
    pub config: Account<'info, MintConfig>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Catalog::INIT_SPACE,
        seeds = [b"catalog", player_id.as_bytes()],
        bump
    )]
    pub catalog: Account<'info, Catalog>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token_id: u64, player_id: String)]
pub struct MintPlayer<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MintConfig>,
    #[account(mut, seeds = [b"catalog", player_id.as_bytes()], bump = catalog.bump)]
    pub catalog: Account<'info, Catalog>,
    #[account(
        init,
        payer = buyer,
        space = 8 + PlayerToken::INIT_SPACE,
        seeds = [b"token", token_id.to_le_bytes().as_ref()],
        bump
    )]
    pub player_token: Account<'info, PlayerToken>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = buyer_usdc.mint == config.usdc_mint @ MintError::WrongMint)]
    pub buyer_usdc: Account<'info, TokenAccount>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = owner)]
    pub config: Account<'info, MintConfig>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = destination.mint == config.usdc_mint @ MintError::WrongMint)]
    pub destination: Account<'info, TokenAccount>,
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ──────────────────────────────────────────────────────────────────────────
// Events & errors
// ──────────────────────────────────────────────────────────────────────────

#[event]
pub struct CatalogSet {
    pub player_id: String,
    pub price: u64,
    pub max_supply: u32,
}

#[event]
pub struct PlayerMinted {
    pub buyer: Pubkey,
    pub player_id: String,
    pub token_id: u64,
    pub paid: u64,
}

#[error_code]
pub enum MintError {
    #[msg("playerId too long (max 32 bytes)")]
    PlayerIdTooLong,
    #[msg("token_id must equal next_token_id")]
    WrongTokenId,
    #[msg("Player not in catalog")]
    NotInCatalog,
    #[msg("Sold out")]
    SoldOut,
    #[msg("Token account mint mismatch")]
    WrongMint,
}
