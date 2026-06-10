import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { baseSepolia, base, type AppKitNetwork } from "@reown/appkit/networks";

// WalletConnect / Reown projectId is public (not a secret); ship a default so
// the connect modal always works, including on production where the env may be
// unset. Override via env if needed.
export const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "ab78ba5feac2c3132c4e017649e93f91";

export const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gaffer.games";

// Base mainnet first = default target chain for the Reown AppKit modal.
// (Sepolia kept available for testing via NEXT_PUBLIC_CHAIN_ID=84532.)
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [base, baseSepolia];

// Mirror lib/chains.ts: default to Base mainnet, fall back to Sepolia only when
// explicitly set. Keeps the connect modal's default network in sync with the
// chain the app actually reads/writes against.
export const defaultNetwork =
  process.env.NEXT_PUBLIC_CHAIN_ID === "84532" ? baseSepolia : base;

export const wagmiAdapter = new WagmiAdapter({
  projectId: wcProjectId,
  networks,
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
export const hasWalletConnect = true;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
