use anchor_lang::prelude::*;

declare_id!("Fhk54QhcVjY7phpxzF7HCPa6STsYD1FN8Jfwk2irdkGf");

/// Gaffer squad NFTs — Solana/Anchor port of `GafferNFT.sol`.
///
/// ERC-721 squad cards become program-owned PDA accounts (no Metaplex): each
/// manager mints exactly one soulbound 5-card squad. Cards are keyed by
/// `["card", owner, slot]` (slot 0..4), so a manager's squad is fully derivable
/// from their wallet — there is no transferable token, matching the soulbound
/// `_beforeTokenTransfer` guard in Solidity.
///
///   NftConfig  ["config"]                  (singleton: owner, squad_wars, next_token_id)
///   Squad      ["squad", owner]            (has_minted + the 5 token ids)
///   Card       ["card", owner, slot]       (per card stats/rarity)
#[program]
pub mod gaffer_nft {
    use super::*;

    pub const GK: u8 = 0;
    pub const FLEX: u8 = 4;

    pub const BRONZE: u8 = 0;
    pub const SILVER: u8 = 1;
    pub const GOLD: u8 = 2;
    pub const ICON: u8 = 3;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.owner = ctx.accounts.owner.key();
        cfg.squad_wars = Pubkey::default(); // set later via set_squad_wars
        cfg.next_token_id = 1;
        cfg.bump = ctx.bumps.config;
        Ok(())
    }

    /// Authorize the SquadWars authority (its signer PDA) to push stat updates.
    pub fn set_squad_wars(ctx: Context<SetSquadWars>, squad_wars: Pubkey) -> Result<()> {
        ctx.accounts.config.squad_wars = squad_wars;
        Ok(())
    }

    /// Mint a manager's one-and-only soulbound squad: 5 cards, exactly one GK.
    pub fn mint_squad(
        ctx: Context<MintSquad>,
        player_ids: [String; 5],
        positions: [u8; 5],
    ) -> Result<()> {
        // Validate formation: every slot a legal position, exactly one GK.
        let mut gk_count = 0u8;
        for &p in positions.iter() {
            require!(p <= FLEX, NftError::InvalidPosition);
            if p == GK {
                gk_count += 1;
            }
        }
        require!(gk_count == 1, NftError::InvalidFormation);

        let cfg = &mut ctx.accounts.config;
        let cards = [
            &mut ctx.accounts.card_0,
            &mut ctx.accounts.card_1,
            &mut ctx.accounts.card_2,
            &mut ctx.accounts.card_3,
            &mut ctx.accounts.card_4,
        ];
        let bumps = [
            ctx.bumps.card_0,
            ctx.bumps.card_1,
            ctx.bumps.card_2,
            ctx.bumps.card_3,
            ctx.bumps.card_4,
        ];

        let owner = ctx.accounts.owner.key();
        let mut token_ids = [0u64; 5];
        for i in 0..5 {
            require!(player_ids[i].len() <= 16, NftError::PlayerIdTooLong);
            let token_id = cfg.next_token_id;
            cfg.next_token_id += 1;

            let card = &mut *cards[i];
            card.owner = owner;
            card.token_id = token_id;
            card.player_id = player_ids[i].clone();
            card.position = positions[i];
            card.rarity = BRONZE;
            card.tournament_pts = 0;
            card.goals = 0;
            card.assists = 0;
            card.clean_sheets = 0;
            card.bump = bumps[i];
            token_ids[i] = token_id;
        }

        let squad = &mut ctx.accounts.squad;
        squad.owner = owner;
        squad.has_minted = true;
        squad.token_ids = token_ids;
        squad.bump = ctx.bumps.squad;

        emit!(SquadMinted { owner, token_ids });
        Ok(())
    }

    /// Accumulate a card's matchday performance and forge rarity. Callable only
    /// by the configured SquadWars authority or the contract owner (mirrors the
    /// Solidity `onlySquadWars` modifier).
    pub fn update_stats(
        ctx: Context<UpdateStats>,
        goals: u8,
        assists: u8,
        clean_sheets: u8,
        points_earned: u32,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        let signer = ctx.accounts.authority.key();
        require!(
            signer == cfg.owner || (cfg.squad_wars != Pubkey::default() && signer == cfg.squad_wars),
            NftError::NotAuthorized
        );

        let card = &mut ctx.accounts.card;
        card.goals = card.goals.saturating_add(goals);
        card.assists = card.assists.saturating_add(assists);
        card.clean_sheets = card.clean_sheets.saturating_add(clean_sheets);
        card.tournament_pts = card.tournament_pts.saturating_add(points_earned);

        let new_rarity = calculate_rarity(card.tournament_pts);
        if new_rarity > card.rarity {
            card.rarity = new_rarity;
            emit!(RarityUpgraded {
                token_id: card.token_id,
                new_rarity,
            });
        }
        emit!(StatsUpdated {
            token_id: card.token_id,
            new_points: card.tournament_pts,
        });
        Ok(())
    }
}

pub fn calculate_rarity(pts: u32) -> u8 {
    if pts >= 150 {
        3 // ICON
    } else if pts >= 80 {
        2 // GOLD
    } else if pts >= 30 {
        1 // SILVER
    } else {
        0 // BRONZE
    }
}

// ──────────────────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct NftConfig {
    pub owner: Pubkey,
    pub squad_wars: Pubkey,
    pub next_token_id: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Squad {
    pub owner: Pubkey,
    pub has_minted: bool,
    pub token_ids: [u64; 5],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Card {
    pub owner: Pubkey,
    pub token_id: u64,
    #[max_len(16)]
    pub player_id: String,
    pub position: u8,
    pub rarity: u8,
    pub tournament_pts: u32,
    pub goals: u8,
    pub assists: u8,
    pub clean_sheets: u8,
    pub bump: u8,
}

// ──────────────────────────────────────────────────────────────────────────
// Accounts
// ──────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + NftConfig::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, NftConfig>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetSquadWars<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = owner)]
    pub config: Account<'info, NftConfig>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintSquad<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, NftConfig>,
    #[account(
        init,
        payer = owner,
        space = 8 + Squad::INIT_SPACE,
        seeds = [b"squad", owner.key().as_ref()],
        bump
    )]
    pub squad: Account<'info, Squad>,
    #[account(init, payer = owner, space = 8 + Card::INIT_SPACE, seeds = [b"card", owner.key().as_ref(), &[0u8]], bump)]
    pub card_0: Account<'info, Card>,
    #[account(init, payer = owner, space = 8 + Card::INIT_SPACE, seeds = [b"card", owner.key().as_ref(), &[1u8]], bump)]
    pub card_1: Account<'info, Card>,
    #[account(init, payer = owner, space = 8 + Card::INIT_SPACE, seeds = [b"card", owner.key().as_ref(), &[2u8]], bump)]
    pub card_2: Account<'info, Card>,
    #[account(init, payer = owner, space = 8 + Card::INIT_SPACE, seeds = [b"card", owner.key().as_ref(), &[3u8]], bump)]
    pub card_3: Account<'info, Card>,
    #[account(init, payer = owner, space = 8 + Card::INIT_SPACE, seeds = [b"card", owner.key().as_ref(), &[4u8]], bump)]
    pub card_4: Account<'info, Card>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateStats<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, NftConfig>,
    #[account(mut)]
    pub card: Account<'info, Card>,
    pub authority: Signer<'info>,
}

// ──────────────────────────────────────────────────────────────────────────
// Events & errors
// ──────────────────────────────────────────────────────────────────────────

#[event]
pub struct SquadMinted {
    pub owner: Pubkey,
    pub token_ids: [u64; 5],
}

#[event]
pub struct StatsUpdated {
    pub token_id: u64,
    pub new_points: u32,
}

#[event]
pub struct RarityUpgraded {
    pub token_id: u64,
    pub new_rarity: u8,
}

#[error_code]
pub enum NftError {
    #[msg("Invalid position")]
    InvalidPosition,
    #[msg("Invalid formation — exactly one GK required")]
    InvalidFormation,
    #[msg("playerId too long (max 16 bytes)")]
    PlayerIdTooLong,
    #[msg("Not authorized")]
    NotAuthorized,
}
