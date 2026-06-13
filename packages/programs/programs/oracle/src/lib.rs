use anchor_lang::prelude::*;

declare_id!("3byJrFHoZ4v9tTo9XAKn1KrE82LZSAxwqMDijVXMf5Yb");

/// Gaffer World Cup Oracle — Solana/Anchor port of `Oracle.sol`.
///
/// Solidity used nested `mapping(matchday => mapping(playerId => stats))`.
/// Solana has no maps, so state is spread across PDAs:
///   - OracleState  seeds=[b"oracle"]                                  (singleton)
///   - Matchday     seeds=[b"matchday", matchday_le]                   (per matchday)
///   - PlayerStat   seeds=[b"stats", matchday_le, player_id_bytes]     (per player/day)
///
/// Scoring (`calculate_points`) is a pure function kept in the crate so the
/// SquadWars program can depend on it directly instead of a cross-program call.
#[program]
pub mod oracle {
    use super::*;

    /// Mirrors the Solidity constructor: seeds the stage multipliers, sets the
    /// stage to Group and the current matchday to 1, and records the owner.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        state.owner = ctx.accounts.owner.key();
        state.current_stage = Stage::Group as u8;
        state.current_matchday = 1;
        // Group, RoundOf16, QuarterFinal, SemiFinal, Final — scaled by 100.
        state.stage_multiplier = [100, 120, 150, 200, 300];
        state.bump = ctx.bumps.oracle_state;
        Ok(())
    }

    /// Write/overwrite one player's stats for a matchday. Allowed only while the
    /// matchday is not yet finalized (matches the Solidity finalize guard).
    /// `post` lazily creates the Matchday tracker (finalized = false).
    pub fn post_player_result(
        ctx: Context<PostPlayerResult>,
        matchday: u64,
        _player_id: String,
        goals: u8,
        assists: u8,
        clean_sheets: u8,
        yellow_cards: u8,
        red_cards: u8,
        played: bool,
    ) -> Result<()> {
        let day = &mut ctx.accounts.matchday_account;
        require!(!day.finalized, OracleError::MatchdayFinalized);
        // Initialize the tracker the first time we touch this matchday.
        if day.matchday == 0 {
            day.matchday = matchday;
            day.bump = ctx.bumps.matchday_account;
        }

        let stat = &mut ctx.accounts.player_stat;
        stat.goals = goals;
        stat.assists = assists;
        stat.clean_sheets = clean_sheets;
        stat.yellow_cards = yellow_cards;
        stat.red_cards = red_cards;
        stat.played = played;
        stat.bump = ctx.bumps.player_stat;
        Ok(())
    }

    /// Finalize a matchday: lock it, snapshot the current stage for deterministic
    /// scoring, and advance `current_matchday`. Equivalent to the tail of
    /// `postMatchdayResults` in Solidity.
    pub fn finalize_matchday(ctx: Context<FinalizeMatchday>, matchday: u64) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        let day = &mut ctx.accounts.matchday_account;
        require!(!day.finalized, OracleError::MatchdayFinalized);

        day.finalized = true;
        day.stage = state.current_stage; // snapshot for deterministic scoring
        if matchday >= state.current_matchday {
            state.current_matchday = matchday + 1;
        }
        emit!(MatchdayPosted { matchday });
        Ok(())
    }

    /// Advance the World Cup stage. Forward-only, owner-only.
    pub fn advance_stage(ctx: Context<AdvanceStage>, new_stage: u8) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        require!(new_stage <= Stage::Final as u8, OracleError::InvalidStage);
        require!(new_stage > state.current_stage, OracleError::StageNotForward);
        state.current_stage = new_stage;
        emit!(StageAdvanced { new_stage });
        Ok(())
    }
}

/// World Cup stages — same ordinals as the Solidity enum.
#[derive(Clone, Copy)]
pub enum Stage {
    Group = 0,
    RoundOf16 = 1,
    QuarterFinal = 2,
    SemiFinal = 3,
    Final = 4,
}

/// Pure scoring function (port of `calculatePoints`). `multiplier` is the
/// stage multiplier scaled by 100 that was snapshotted at finalize time —
/// callers pass `matchday.stage`'s multiplier, never the live stage.
pub fn calculate_points(stat: &PlayerStat, position: u8, multiplier: u16) -> u64 {
    if !stat.played {
        return 0;
    }
    let g = stat.goals as u64;
    let a = stat.assists as u64;
    let cs = stat.clean_sheets as u64;

    // position: 0=GK, 1=DEF, 2=MID, 3=FWD, 4=FLEX
    let mut points: u64 = match position {
        0 => cs * 12 + g * 10 + a * 6,
        1 => cs * 8 + g * 8 + a * 6,
        2 => g * 8 + a * 6 + cs * 4,
        3 => g * 10 + a * 4,
        _ => g * 8 + a * 5,
    };

    if stat.red_cards > 0 {
        points = if points > 4 { points - 4 } else { 0 };
    }

    points * multiplier as u64 / 100
}

// ──────────────────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct OracleState {
    pub owner: Pubkey,
    pub current_stage: u8,
    pub current_matchday: u64,
    pub stage_multiplier: [u16; 5],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Matchday {
    pub matchday: u64,
    pub finalized: bool,
    pub stage: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerStat {
    pub goals: u8,
    pub assists: u8,
    pub clean_sheets: u8,
    pub yellow_cards: u8,
    pub red_cards: u8,
    pub played: bool,
    pub bump: u8,
}

// ──────────────────────────────────────────────────────────────────────────
// Accounts
// ──────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + OracleState::INIT_SPACE,
        seeds = [b"oracle"],
        bump
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(matchday: u64, player_id: String)]
pub struct PostPlayerResult<'info> {
    #[account(seeds = [b"oracle"], bump = oracle_state.bump, has_one = owner)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Matchday::INIT_SPACE,
        seeds = [b"matchday", &matchday.to_le_bytes()],
        bump
    )]
    pub matchday_account: Account<'info, Matchday>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + PlayerStat::INIT_SPACE,
        seeds = [b"stats".as_ref(), matchday.to_le_bytes().as_ref(), player_id.as_bytes()],
        bump
    )]
    pub player_stat: Account<'info, PlayerStat>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(matchday: u64)]
pub struct FinalizeMatchday<'info> {
    #[account(mut, seeds = [b"oracle"], bump = oracle_state.bump, has_one = owner)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        mut,
        seeds = [b"matchday", &matchday.to_le_bytes()],
        bump = matchday_account.bump
    )]
    pub matchday_account: Account<'info, Matchday>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdvanceStage<'info> {
    #[account(mut, seeds = [b"oracle"], bump = oracle_state.bump, has_one = owner)]
    pub oracle_state: Account<'info, OracleState>,
    pub owner: Signer<'info>,
}

// ──────────────────────────────────────────────────────────────────────────
// Events & errors
// ──────────────────────────────────────────────────────────────────────────

#[event]
pub struct MatchdayPosted {
    pub matchday: u64,
}

#[event]
pub struct StageAdvanced {
    pub new_stage: u8,
}

#[error_code]
pub enum OracleError {
    #[msg("Matchday already finalized")]
    MatchdayFinalized,
    #[msg("Can only advance forward")]
    StageNotForward,
    #[msg("Invalid stage")]
    InvalidStage,
}
