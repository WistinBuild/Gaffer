import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { baseSepolia, base, type AppKitNetwork } from "@reown/appkit/networks";

// WalletConnect / Reown projectId is public (not a secret); ship a default so
// the connect modal always works, including on production where the env may be
// unset. Override via env if needed.
export const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "ab78ba5feac2c3132c4e017649e93f91";

export const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gaffer.games";

// Base mainnet first = default target chain for the Reown AppKit modal.
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [baseSepolia, base];

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
