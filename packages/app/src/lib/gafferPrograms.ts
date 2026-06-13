/**
 * Gaffer Solana program client SDK.
 *
 * Replaces the EVM (wagmi/viem) contract layer with reads/writes against the
 * four Anchor programs deployed on devnet (see packages/programs). Pure — no
 * React — so it can be unit-checked against live accounts from node.
 *
 * Account layouts here are hand-written borsh decoders that mirror the Rust
 * `#[account]` structs (8-byte Anchor discriminator + fields in declaration
 * order). Instruction data = sha256("global:<ix>")[..8] + borsh(args).
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";

// ─── Program IDs (devnet) ─────────────────────────────────────────────────────
export const ORACLE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID || "3byJrFHoZ4v9tTo9XAKn1KrE82LZSAxwqMDijVXMf5Yb",
);
export const GAFFER_NFT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_GAFFER_NFT_PROGRAM_ID || "Fhk54QhcVjY7phpxzF7HCPa6STsYD1FN8Jfwk2irdkGf",
);
export const PLAYER_MINT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PLAYER_MINT_PROGRAM_ID || "D9xiskVonYcZs3zMnjeKS9HY27s2fcBxTD3Jw5op2XoY",
);
export const SQUAD_WARS_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SQUAD_WARS_PROGRAM_ID || "25MeET8DMNgM8VCJTXxDQVPAaJsp5HezyhypofbYdaqh",
);

export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

// ─── tiny borsh reader ────────────────────────────────────────────────────────
class Reader {
  off: number;
  constructor(public buf: Buffer, start = 0) {
    this.off = start;
  }
  u8() {
    return this.buf.readUInt8(this.off++);
  }
  bool() {
    return this.u8() !== 0;
  }
  u16() {
    const v = this.buf.readUInt16LE(this.off);
    this.off += 2;
    return v;
  }
  u32() {
    const v = this.buf.readUInt32LE(this.off);
    this.off += 4;
    return v;
  }
  u64() {
    const v = this.buf.readBigUInt64LE(this.off);
    this.off += 8;
    return v;
  }
  i64() {
    const v = this.buf.readBigInt64LE(this.off);
    this.off += 8;
    return v;
  }
  pubkey() {
    const pk = new PublicKey(this.buf.subarray(this.off, this.off + 32));
    this.off += 32;
    return pk;
  }
  string() {
    const len = this.u32();
    const s = this.buf.toString("utf8", this.off, this.off + len);
    this.off += len;
    return s;
  }
}

// ─── tiny borsh writer (instruction args) ────────────────────────────────────
class Writer {
  parts: Buffer[] = [];
  u8(v: number) {
    this.parts.push(Buffer.from([v & 0xff]));
    return this;
  }
  bool(v: boolean) {
    return this.u8(v ? 1 : 0);
  }
  u16(v: number) {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v);
    this.parts.push(b);
    return this;
  }
  u32(v: number) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v);
    this.parts.push(b);
    return this;
  }
  u64(v: bigint | number) {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(v));
    this.parts.push(b);
    return this;
  }
  string(s: string) {
    const bytes = Buffer.from(s, "utf8");
    this.u32(bytes.length);
    this.parts.push(bytes);
    return this;
  }
  raw(b: Buffer) {
    this.parts.push(b);
    return this;
  }
  build() {
    return Buffer.concat(this.parts);
  }
}

const disc = (name: string) => Buffer.from(sha256(`global:${name}`)).subarray(0, 8);
const u64le = (n: bigint | number) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

// ─── PDA derivations ──────────────────────────────────────────────────────────
export const oracleStatePda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("oracle")], ORACLE_PROGRAM_ID)[0];
export const matchdayPda = (matchday: bigint | number) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("matchday"), u64le(matchday)],
    ORACLE_PROGRAM_ID,
  )[0];
export const playerStatPda = (matchday: bigint | number, playerId: string) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("stats"), u64le(matchday), Buffer.from(playerId, "utf8")],
    ORACLE_PROGRAM_ID,
  )[0];

export const nftConfigPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("config")], GAFFER_NFT_PROGRAM_ID)[0];
export const squadPda = (owner: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("squad"), owner.toBuffer()],
    GAFFER_NFT_PROGRAM_ID,
  )[0];
export const cardPda = (owner: PublicKey, slot: number) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("card"), owner.toBuffer(), Buffer.from([slot])],
    GAFFER_NFT_PROGRAM_ID,
  )[0];

export const mintConfigPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("config")], PLAYER_MINT_PROGRAM_ID)[0];
export const mintVaultPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("vault")], PLAYER_MINT_PROGRAM_ID)[0];
export const catalogPda = (playerId: string) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("catalog"), Buffer.from(playerId, "utf8")],
    PLAYER_MINT_PROGRAM_ID,
  )[0];
export const playerTokenPda = (tokenId: bigint | number) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("token"), u64le(tokenId)],
    PLAYER_MINT_PROGRAM_ID,
  )[0];

export const warsConfigPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("config")], SQUAD_WARS_PROGRAM_ID)[0];
export const warsVaultPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("vault")], SQUAD_WARS_PROGRAM_ID)[0];
export const warPda = (warId: bigint | number) =>
  PublicKey.findProgramAddressSync([Buffer.from("war"), u64le(warId)], SQUAD_WARS_PROGRAM_ID)[0];
export const managerStatsPda = (manager: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("mgr"), manager.toBuffer()],
    SQUAD_WARS_PROGRAM_ID,
  )[0];

// associated token account (SPL), derived classically
export const ataPda = (owner: PublicKey, mint = USDC_MINT) =>
  PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];

// ─── account decoders (data shapes mirror the old EVM reads) ─────────────────
export interface ChainCard {
  playerId: string;
  position: number;
  rarity: number;
  tournamentPts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
}
export interface ChainWar {
  id: bigint;
  challenger: string;
  opponent: string;
  stake: bigint;
  matchday: bigint;
  captainSlot: number;
  benchedSlot: number;
  opponentCaptainSlot: number;
  opponentBenchedSlot: number;
  challengerScore: bigint;
  opponentScore: bigint;
  status: number;
  winner: string;
  decisionLocked: boolean;
}
export interface PlayerCatalog {
  position: number;
  rating: number;
  isLegend: boolean;
  price: bigint;
  maxSupply: number;
  minted: number;
  exists: boolean;
}
export interface PlayerTokenInfo {
  tokenId: bigint;
  playerId: string;
  position: number;
  rating: number;
  isLegend: boolean;
  mintedAt: bigint;
  owner: string;
}

export function decodeCard(data: Buffer): ChainCard {
  const r = new Reader(data, 8);
  r.pubkey(); // owner
  r.u64(); // token_id
  const playerId = r.string();
  const position = r.u8();
  const rarity = r.u8();
  const tournamentPts = r.u32();
  const goals = r.u8();
  const assists = r.u8();
  const cleanSheets = r.u8();
  return { playerId, position, rarity, tournamentPts, goals, assists, cleanSheets };
}

export function decodeSquad(data: Buffer): { hasMinted: boolean; tokenIds: bigint[] } {
  const r = new Reader(data, 8);
  r.pubkey(); // owner
  const hasMinted = r.bool();
  const tokenIds = Array.from({ length: 5 }, () => r.u64());
  return { hasMinted, tokenIds };
}

export function decodeWar(data: Buffer): ChainWar {
  const r = new Reader(data, 8);
  const id = r.u64();
  const challenger = r.pubkey().toBase58();
  const opponent = r.pubkey().toBase58();
  const stake = r.u64();
  const matchday = r.u64();
  const captainSlot = r.u8();
  const benchedSlot = r.u8();
  const opponentCaptainSlot = r.u8();
  const opponentBenchedSlot = r.u8();
  const challengerScore = r.u64();
  const opponentScore = r.u64();
  const status = r.u8();
  const winner = r.pubkey().toBase58();
  return {
    id,
    challenger,
    opponent,
    stake,
    matchday,
    captainSlot,
    benchedSlot,
    opponentCaptainSlot,
    opponentBenchedSlot,
    challengerScore,
    opponentScore,
    status,
    winner,
    decisionLocked: false,
  };
}

export function decodeManagerStats(data: Buffer): { manager: string; wins: number; losses: number } {
  const r = new Reader(data, 8);
  const manager = r.pubkey().toBase58();
  const wins = Number(r.u64());
  const losses = Number(r.u64());
  return { manager, wins, losses };
}

export function decodeCatalog(data: Buffer): PlayerCatalog {
  const r = new Reader(data, 8);
  const position = r.u8();
  const rating = r.u16();
  const isLegend = r.bool();
  const price = r.u64();
  const maxSupply = r.u32();
  const minted = r.u32();
  const exists = r.bool();
  return { position, rating, isLegend, price, maxSupply, minted, exists };
}

export function decodePlayerToken(data: Buffer): PlayerTokenInfo {
  const r = new Reader(data, 8);
  const owner = r.pubkey().toBase58();
  const tokenId = r.u64();
  const playerId = r.string();
  const position = r.u8();
  const rating = r.u16();
  const isLegend = r.bool();
  const mintedAt = r.i64();
  return { tokenId, playerId, position, rating, isLegend, mintedAt, owner };
}

// ─── reads ────────────────────────────────────────────────────────────────────
export async function getSquadCards(conn: Connection, owner: PublicKey): Promise<ChainCard[] | null> {
  const squadInfo = await conn.getAccountInfo(squadPda(owner));
  if (!squadInfo) return null;
  const { hasMinted } = decodeSquad(squadInfo.data);
  if (!hasMinted) return null;
  const cardPdas = Array.from({ length: 5 }, (_, i) => cardPda(owner, i));
  const infos = await conn.getMultipleAccountsInfo(cardPdas);
  return infos.map((ai) => (ai ? decodeCard(ai.data) : null)).filter(Boolean) as ChainCard[];
}

export async function hasMintedSquad(conn: Connection, owner: PublicKey): Promise<boolean> {
  const info = await conn.getAccountInfo(squadPda(owner));
  return info ? decodeSquad(info.data).hasMinted : false;
}

export async function getManagerStats(conn: Connection, owner: PublicKey) {
  const info = await conn.getAccountInfo(managerStatsPda(owner));
  if (!info) return { wins: 0, losses: 0 };
  const s = decodeManagerStats(info.data);
  return { wins: s.wins, losses: s.losses };
}

export async function getWar(conn: Connection, warId: bigint | number): Promise<ChainWar | null> {
  const info = await conn.getAccountInfo(warPda(warId));
  return info ? decodeWar(info.data) : null;
}

/** Read every war up to the current counter (next_war_id - 1). */
export async function getAllWars(conn: Connection): Promise<ChainWar[]> {
  const cfg = await conn.getAccountInfo(warsConfigPda());
  if (!cfg) return [];
  // WarsConfig: disc(8)+owner+resolver+oracle+nft+usdc_mint (5*32) then next_war_id u64
  const next = new Reader(cfg.data, 8 + 32 * 5).u64();
  const count = Number(next) - 1;
  if (count <= 0) return [];
  const pdas = Array.from({ length: count }, (_, i) => warPda(i + 1));
  const infos = await conn.getMultipleAccountsInfo(pdas);
  return infos.map((ai) => (ai ? decodeWar(ai.data) : null)).filter(Boolean) as ChainWar[];
}

/** Leaderboard: scan all ManagerStats accounts, sort by wins desc. */
export async function getLeaderboard(conn: Connection, limit = 10) {
  const accs = await conn.getProgramAccounts(SQUAD_WARS_PROGRAM_ID, {
    filters: [{ dataSize: 8 + 32 + 8 + 8 + 1 }], // ManagerStats size
  });
  const rows = accs
    .map((a) => decodeManagerStats(a.account.data))
    .sort((x, y) => y.wins - x.wins)
    .slice(0, limit);
  return rows.map((r) => ({ manager: r.manager, wins: r.wins, losses: r.losses }));
}

export async function getCatalog(conn: Connection, playerId: string): Promise<PlayerCatalog | null> {
  const info = await conn.getAccountInfo(catalogPda(playerId));
  return info ? decodeCatalog(info.data) : null;
}

export async function getCatalogBatch(conn: Connection, playerIds: string[]) {
  const infos = await conn.getMultipleAccountsInfo(playerIds.map((id) => catalogPda(id)));
  const out: Record<string, PlayerCatalog> = {};
  playerIds.forEach((id, i) => {
    if (infos[i]) out[id] = decodeCatalog(infos[i]!.data);
  });
  return out;
}

/** All PlayerToken NFTs owned by `owner` (owner is first field after disc). */
export async function getPlayerTokensOf(conn: Connection, owner: PublicKey) {
  const accs = await conn.getProgramAccounts(PLAYER_MINT_PROGRAM_ID, {
    filters: [{ memcmp: { offset: 8, bytes: owner.toBase58() } }],
  });
  return accs.map((a) => decodePlayerToken(a.account.data));
}

/** Current next_token_id from the PlayerMint MintConfig (owner+usdc_mint then u64). */
export async function nextTokenId(conn: Connection): Promise<bigint> {
  const info = await conn.getAccountInfo(mintConfigPda());
  if (!info) return BigInt(1);
  return new Reader(info.data, 8 + 32 + 32).u64();
}

/** Current next_war_id from the SquadWars WarsConfig (5 pubkeys then u64). */
export async function nextWarId(conn: Connection): Promise<bigint> {
  const info = await conn.getAccountInfo(warsConfigPda());
  if (!info) return BigInt(1);
  return new Reader(info.data, 8 + 32 * 5).u64();
}

// ─── instruction builders (writes) ───────────────────────────────────────────
const key = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({
  pubkey,
  isSigner,
  isWritable,
});

export function ixMintSquad(owner: PublicKey, playerIds: string[], positions: number[]) {
  const w = new Writer().raw(disc("mint_squad"));
  for (let i = 0; i < 5; i++) w.string(playerIds[i]);
  for (let i = 0; i < 5; i++) w.u8(positions[i]);
  return new TransactionInstruction({
    programId: GAFFER_NFT_PROGRAM_ID,
    keys: [
      key(nftConfigPda(), false, true),
      key(squadPda(owner), false, true),
      ...Array.from({ length: 5 }, (_, i) => key(cardPda(owner, i), false, true)),
      key(owner, true, true),
      key(SystemProgram.programId, false, false),
    ],
    data: w.build(),
  });
}

export function ixMintPlayer(
  buyer: PublicKey,
  tokenId: bigint | number,
  playerId: string,
  buyerUsdc: PublicKey,
) {
  const data = new Writer().raw(disc("mint_player")).u64(tokenId).string(playerId).build();
  return new TransactionInstruction({
    programId: PLAYER_MINT_PROGRAM_ID,
    keys: [
      key(mintConfigPda(), false, true),
      key(catalogPda(playerId), false, true),
      key(playerTokenPda(tokenId), false, true),
      key(mintVaultPda(), false, true),
      key(buyerUsdc, false, true),
      key(buyer, true, true),
      key(TOKEN_PROGRAM_ID, false, false),
      key(SystemProgram.programId, false, false),
    ],
    data,
  });
}

export function ixCreateWar(
  challenger: PublicKey,
  warId: bigint | number,
  matchday: bigint | number,
  stake: bigint | number,
  challengerUsdc: PublicKey,
) {
  const data = new Writer()
    .raw(disc("create_war"))
    .u64(warId)
    .u64(matchday)
    .u64(stake)
    .build();
  return new TransactionInstruction({
    programId: SQUAD_WARS_PROGRAM_ID,
    keys: [
      key(warsConfigPda(), false, true),
      key(warPda(warId), false, true),
      key(warsVaultPda(), false, true),
      key(challengerUsdc, false, true),
      key(challenger, true, true),
      key(TOKEN_PROGRAM_ID, false, false),
      key(SystemProgram.programId, false, false),
    ],
    data,
  });
}

export function ixAcceptWar(opponent: PublicKey, warId: bigint | number, opponentUsdc: PublicKey) {
  return new TransactionInstruction({
    programId: SQUAD_WARS_PROGRAM_ID,
    keys: [
      key(warsConfigPda(), false, false),
      key(warPda(warId), false, true),
      key(warsVaultPda(), false, true),
      key(opponentUsdc, false, true),
      key(opponent, true, true),
      key(TOKEN_PROGRAM_ID, false, false),
    ],
    data: disc("accept_war"),
  });
}

export function ixLockDecision(
  manager: PublicKey,
  warId: bigint | number,
  captainSlot: number,
  benchedSlot: number,
) {
  const data = new Writer().raw(disc("lock_decision")).u8(captainSlot).u8(benchedSlot).build();
  return new TransactionInstruction({
    programId: SQUAD_WARS_PROGRAM_ID,
    keys: [key(warPda(warId), false, true), key(manager, true, false)],
    data,
  });
}

export function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
