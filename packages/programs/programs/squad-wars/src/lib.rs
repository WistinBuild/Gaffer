use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("25MeET8DMNgM8VCJTXxDQVPAaJsp5HezyhypofbYdaqh");

/// Gaffer PvP squad wars — Solana/Anchor port of `SquadWars.sol`.
///
/// Two managers stake equal USDC on a matchday; the higher squad score wins the
/// pot minus a 5% protocol fee. All staked USDC is escrowed in a single program
/// vault PDA and paid out on resolve. War lifecycle mirrors the Solidity
/// contract: Open → Active → Resolved (or Cancelled).
///
/// SCORING TRADE-OFF: in Solidity, `resolveWar` recomputed both scores on-chain
/// by reading the Oracle + GafferNFT. Here the scores are computed off-chain by
/// the authorized `resolver` (the same trusted oracle/bot authority that posts
/// matchday results) and submitted to `resolve_war`. The *money* path — escrow,
/// fee, payout, draw refund — stays fully on-chain and trustless. Trustless
/// on-chain scoring (reading oracle/nft PDAs per slot) is future work.
///
///   WarsConfig    ["config"]            (owner, resolver, usdc_mint, next_war_id)
///   vault         ["vault"]             (USDC escrow, self-authority)
///   War           ["war", war_id]       (one head-to-head)
///   ManagerStats  ["mgr", manager]      (win/loss record)
#[program]
pub mod squad_wars {
    use super::*;

    pub const MIN_STAKE: u64 = 1_000; // 0.001 USDC (6 decimals)
    pub const PROTOCOL_FEE: u64 = 50; // 5% scaled by 1000

    pub fn initialize(ctx: Context<Initialize>, oracle: Pubkey, nft: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.owner = ctx.accounts.owner.key();
        cfg.resolver = ctx.accounts.owner.key(); // owner resolves by default
        cfg.oracle = oracle;
        cfg.nft = nft;
        cfg.usdc_mint = ctx.accounts.usdc_mint.key();
        cfg.next_war_id = 1;
        cfg.bump = ctx.bumps.config;
        cfg.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    /// Point at a new Oracle (e.g. after an Oracle bugfix redeploy) without
    /// losing war history. Owner-only.
    pub fn set_oracle(ctx: Context<AdminConfig>, oracle: Pubkey) -> Result<()> {
        require!(oracle != Pubkey::default(), WarError::ZeroAddress);
        ctx.accounts.config.oracle = oracle;
        emit!(OracleUpdated { oracle });
        Ok(())
    }

    /// Authorize who may submit war scores (defaults to owner).
    pub fn set_resolver(ctx: Context<AdminConfig>, resolver: Pubkey) -> Result<()> {
        require!(resolver != Pubkey::default(), WarError::ZeroAddress);
        ctx.accounts.config.resolver = resolver;
        Ok(())
    }

    /// Create a war and escrow the challenger's stake. `war_id` must equal the
    /// current `next_war_id` (it seeds the War PDA).
    pub fn create_war(
        ctx: Context<CreateWar>,
        war_id: u64,
        matchday: u64,
        stake: u64,
    ) -> Result<()> {
        require!(stake >= MIN_STAKE, WarError::StakeTooLow);
        let cfg = &mut ctx.accounts.config;
        require!(war_id == cfg.next_war_id, WarError::WrongWarId);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.challenger_usdc.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.challenger.to_account_info(),
                },
            ),
            stake,
        )?;

        let war = &mut ctx.accounts.war;
        war.id = war_id;
        war.challenger = ctx.accounts.challenger.key();
        war.opponent = Pubkey::default();
        war.stake = stake;
        war.matchday = matchday;
        war.captain_slot = 0;
        war.benched_slot = 4;
        war.opponent_captain_slot = 0;
        war.opponent_benched_slot = 4;
        war.challenger_score = 0;
        war.opponent_score = 0;
        war.status = WarStatus::Open as u8;
        war.winner = Pubkey::default();
        war.bump = ctx.bumps.war;

        cfg.next_war_id += 1;
        emit!(WarCreated {
            war_id,
            challenger: war.challenger,
            stake,
            matchday,
        });
        Ok(())
    }

    /// Accept an open war and escrow a matching stake.
    pub fn accept_war(ctx: Context<AcceptWar>) -> Result<()> {
        let war = &mut ctx.accounts.war;
        require!(war.status == WarStatus::Open as u8, WarError::NotOpen);
        require!(
            war.challenger != ctx.accounts.opponent.key(),
            WarError::CannotFightYourself
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.opponent_usdc.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.opponent.to_account_info(),
                },
            ),
            war.stake,
        )?;

        war.opponent = ctx.accounts.opponent.key();
        war.status = WarStatus::Active as u8;
        emit!(WarAccepted {
            war_id: war.id,
            opponent: war.opponent,
        });
        Ok(())
    }

    /// Set captain (2x) and benched (0x) slots for the caller's side.
    pub fn lock_decision(ctx: Context<LockDecision>, captain_slot: u8, benched_slot: u8) -> Result<()> {
        let war = &mut ctx.accounts.war;
        require!(war.status == WarStatus::Active as u8, WarError::NotActive);
        require!(captain_slot < 5 && benched_slot < 5, WarError::InvalidSlot);
        require!(captain_slot != benched_slot, WarError::CaptainBenchSame);

        let who = ctx.accounts.manager.key();
        if who == war.challenger {
            war.captain_slot = captain_slot;
            war.benched_slot = benched_slot;
        } else if who == war.opponent {
            war.opponent_captain_slot = captain_slot;
            war.opponent_benched_slot = benched_slot;
        } else {
            return err!(WarError::NotInThisWar);
        }
        emit!(DecisionLocked {
            war_id: war.id,
            manager: who,
            captain: captain_slot,
            benched: benched_slot,
        });
        Ok(())
    }

    /// Resolve a war with scores submitted by the authorized resolver, then pay
    /// out the escrowed pot. Mirrors the Solidity fee/draw/payout math exactly.
    pub fn resolve_war(
        ctx: Context<ResolveWar>,
        challenger_score: u64,
        opponent_score: u64,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(
            ctx.accounts.resolver.key() == cfg.resolver || ctx.accounts.resolver.key() == cfg.owner,
            WarError::NotAuthorized
        );
        let war = &mut ctx.accounts.war;
        require!(war.status == WarStatus::Active as u8, WarError::NotActive);

        // Verify the passed token accounts belong to the right parties.
        require!(ctx.accounts.challenger_usdc.owner == war.challenger, WarError::WrongTokenOwner);
        require!(ctx.accounts.opponent_usdc.owner == war.opponent, WarError::WrongTokenOwner);
        require!(ctx.accounts.fee_usdc.owner == cfg.owner, WarError::WrongTokenOwner);

        war.challenger_score = challenger_score;
        war.opponent_score = opponent_score;

        let total_pot = war.stake * 2;
        let fee = total_pot * PROTOCOL_FEE / 1000;
        let winner_pot = total_pot - fee;

        let bump = cfg.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", &[bump]]];

        if challenger_score > opponent_score {
            war.winner = war.challenger;
            ctx.accounts.challenger_stats.wins += 1;
            ctx.accounts.opponent_stats.losses += 1;
            pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.challenger_usdc, signer_seeds, winner_pot)?;
            pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.fee_usdc, signer_seeds, fee)?;
            war.status = WarStatus::Resolved as u8;
            emit!(WarResolved { war_id: war.id, winner: war.winner, payout: winner_pot });
        } else if opponent_score > challenger_score {
            war.winner = war.opponent;
            ctx.accounts.opponent_stats.wins += 1;
            ctx.accounts.challenger_stats.losses += 1;
            pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.opponent_usdc, signer_seeds, winner_pot)?;
            pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.fee_usdc, signer_seeds, fee)?;
            war.status = WarStatus::Resolved as u8;
            emit!(WarResolved { war_id: war.id, winner: war.winner, payout: winner_pot });
        } else {
            // Draw: refund both sides their share minus fee; sweep dust to owner.
            let refund = (total_pot - fee) / 2;
            let dust = total_pot - 2 * refund;
            pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.challenger_usdc, signer_seeds, refund)?;
            pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.opponent_usdc, signer_seeds, refund)?;
            pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.fee_usdc, signer_seeds, dust)?;
            war.status = WarStatus::Resolved as u8;
            emit!(WarResolved { war_id: war.id, winner: Pubkey::default(), payout: refund });
        }
        Ok(())
    }

    /// Challenger (or owner) cancels an open, unaccepted war and is refunded.
    pub fn cancel_war(ctx: Context<CancelWar>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        let war = &mut ctx.accounts.war;
        require!(war.status == WarStatus::Open as u8, WarError::NotOpen);
        require!(
            ctx.accounts.signer.key() == war.challenger || ctx.accounts.signer.key() == cfg.owner,
            WarError::NotAuthorized
        );
        require!(ctx.accounts.challenger_usdc.owner == war.challenger, WarError::WrongTokenOwner);

        let bump = cfg.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", &[bump]]];
        pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.challenger_usdc, signer_seeds, war.stake)?;

        war.status = WarStatus::Cancelled as u8;
        emit!(WarCancelled { war_id: war.id });
        Ok(())
    }

    /// Owner-only recovery: refund a stuck war (e.g. matchday never finalized).
    pub fn admin_cancel_war(ctx: Context<AdminCancelWar>) -> Result<()> {
        let war = &mut ctx.accounts.war;
        require!(
            war.status == WarStatus::Open as u8 || war.status == WarStatus::Active as u8,
            WarError::NotCancellable
        );
        let was_active = war.status == WarStatus::Active as u8;
        require!(ctx.accounts.challenger_usdc.owner == war.challenger, WarError::WrongTokenOwner);

        let bump = ctx.accounts.config.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", &[bump]]];
        pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.challenger_usdc, signer_seeds, war.stake)?;
        if was_active {
            require!(ctx.accounts.opponent_usdc.owner == war.opponent, WarError::WrongTokenOwner);
            pay(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.opponent_usdc, signer_seeds, war.stake)?;
        }
        war.status = WarStatus::Cancelled as u8;
        emit!(WarCancelled { war_id: war.id });
        Ok(())
    }
}

/// Helper: transfer `amount` USDC out of the vault, signed by the vault PDA.
fn pay<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    signer_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: vault.to_account_info(),
                to: to.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )
}

#[derive(Clone, Copy, PartialEq)]
pub enum WarStatus {
    Open = 0,
    Active = 1,
    Resolved = 2,
    Cancelled = 3,
}

// ──────────────────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct WarsConfig {
    pub owner: Pubkey,
    pub resolver: Pubkey,
    pub oracle: Pubkey,
    pub nft: Pubkey,
    pub usdc_mint: Pubkey,
    pub next_war_id: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct War {
    pub id: u64,
    pub challenger: Pubkey,
    pub opponent: Pubkey,
    pub stake: u64,
    pub matchday: u64,
    pub captain_slot: u8,
    pub benched_slot: u8,
    pub opponent_captain_slot: u8,
    pub opponent_benched_slot: u8,
    pub challenger_score: u64,
    pub opponent_score: u64,
    pub status: u8,
    pub winner: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ManagerStats {
    pub manager: Pubkey,
    pub wins: u64,
    pub losses: u64,
    pub bump: u8,
}

// ──────────────────────────────────────────────────────────────────────────
// Accounts
// ──────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + WarsConfig::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, WarsConfig>,
    #[account(
        init,
        payer = owner,
        seeds = [b"vault"],
        bump,
        token::mint = usdc_mint,
        token::authority = vault
    )]
    pub vault: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminConfig<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = owner)]
    pub config: Account<'info, WarsConfig>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(war_id: u64)]
pub struct CreateWar<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, WarsConfig>,
    #[account(
        init,
        payer = challenger,
        space = 8 + War::INIT_SPACE,
        seeds = [b"war", war_id.to_le_bytes().as_ref()],
        bump
    )]
    pub war: Account<'info, War>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = challenger_usdc.mint == config.usdc_mint @ WarError::WrongMint)]
    pub challenger_usdc: Account<'info, TokenAccount>,
    #[account(mut)]
    pub challenger: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptWar<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, WarsConfig>,
    #[account(mut, seeds = [b"war", war.id.to_le_bytes().as_ref()], bump = war.bump)]
    pub war: Account<'info, War>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = opponent_usdc.mint == config.usdc_mint @ WarError::WrongMint)]
    pub opponent_usdc: Account<'info, TokenAccount>,
    #[account(mut)]
    pub opponent: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LockDecision<'info> {
    #[account(mut, seeds = [b"war", war.id.to_le_bytes().as_ref()], bump = war.bump)]
    pub war: Account<'info, War>,
    pub manager: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveWar<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, WarsConfig>,
    #[account(mut, seeds = [b"war", war.id.to_le_bytes().as_ref()], bump = war.bump)]
    pub war: Account<'info, War>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = challenger_usdc.mint == config.usdc_mint @ WarError::WrongMint)]
    pub challenger_usdc: Account<'info, TokenAccount>,
    #[account(mut, constraint = opponent_usdc.mint == config.usdc_mint @ WarError::WrongMint)]
    pub opponent_usdc: Account<'info, TokenAccount>,
    #[account(mut, constraint = fee_usdc.mint == config.usdc_mint @ WarError::WrongMint)]
    pub fee_usdc: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = resolver,
        space = 8 + ManagerStats::INIT_SPACE,
        seeds = [b"mgr", war.challenger.as_ref()],
        bump
    )]
    pub challenger_stats: Account<'info, ManagerStats>,
    #[account(
        init_if_needed,
        payer = resolver,
        space = 8 + ManagerStats::INIT_SPACE,
        seeds = [b"mgr", war.opponent.as_ref()],
        bump
    )]
    pub opponent_stats: Account<'info, ManagerStats>,
    #[account(mut)]
    pub resolver: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelWar<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, WarsConfig>,
    #[account(mut, seeds = [b"war", war.id.to_le_bytes().as_ref()], bump = war.bump)]
    pub war: Account<'info, War>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = challenger_usdc.mint == config.usdc_mint @ WarError::WrongMint)]
    pub challenger_usdc: Account<'info, TokenAccount>,
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminCancelWar<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = owner)]
    pub config: Account<'info, WarsConfig>,
    #[account(mut, seeds = [b"war", war.id.to_le_bytes().as_ref()], bump = war.bump)]
    pub war: Account<'info, War>,
    #[account(mut, seeds = [b"vault"], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = challenger_usdc.mint == config.usdc_mint @ WarError::WrongMint)]
    pub challenger_usdc: Account<'info, TokenAccount>,
    #[account(mut, constraint = opponent_usdc.mint == config.usdc_mint @ WarError::WrongMint)]
    pub opponent_usdc: Account<'info, TokenAccount>,
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ──────────────────────────────────────────────────────────────────────────
// Events & errors
// ──────────────────────────────────────────────────────────────────────────

#[event]
pub struct WarCreated {
    pub war_id: u64,
    pub challenger: Pubkey,
    pub stake: u64,
    pub matchday: u64,
}
#[event]
pub struct WarAccepted {
    pub war_id: u64,
    pub opponent: Pubkey,
}
#[event]
pub struct DecisionLocked {
    pub war_id: u64,
    pub manager: Pubkey,
    pub captain: u8,
    pub benched: u8,
}
#[event]
pub struct WarResolved {
    pub war_id: u64,
    pub winner: Pubkey,
    pub payout: u64,
}
#[event]
pub struct WarCancelled {
    pub war_id: u64,
}
#[event]
pub struct OracleUpdated {
    pub oracle: Pubkey,
}

#[error_code]
pub enum WarError {
    #[msg("Stake too low")]
    StakeTooLow,
    #[msg("war_id must equal next_war_id")]
    WrongWarId,
    #[msg("War not open")]
    NotOpen,
    #[msg("War not active")]
    NotActive,
    #[msg("Cannot fight yourself")]
    CannotFightYourself,
    #[msg("Invalid slot")]
    InvalidSlot,
    #[msg("Captain and bench must differ")]
    CaptainBenchSame,
    #[msg("Not in this war")]
    NotInThisWar,
    #[msg("Not authorized")]
    NotAuthorized,
    #[msg("Not cancellable")]
    NotCancellable,
    #[msg("Zero address")]
    ZeroAddress,
    #[msg("Token account mint mismatch")]
    WrongMint,
    #[msg("Token account owner mismatch")]
    WrongTokenOwner,
}
