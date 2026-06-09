import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { base, baseSepolia } from "./chains";

// WalletConnect needs a projectId from https://cloud.reown.com (formerly
// WalletConnect Cloud). The projectId is public (not a secret), so we ship a
// default so the WalletConnect QR/mobile popup always works — including on
// production where the env var may be unset. Override via env if needed.
const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "ab78ba5feac2c3132c4e017649e93f91";
const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gaffer.games";

const connectors = [
  injected({ shimDisconnect: true }), // MetaMask / Rabby / browser extensions
  coinbaseWallet({ appName: "Gaffer", preference: "all" }),
  walletConnect({
    projectId: wcProjectId,
    showQrModal: true, // official WalletConnect modal (QR + mobile deep links)
    metadata: {
      name: "Gaffer",
      description: "On-chain fantasy football manager",
      url: appUrl,
      icons: [`${appUrl}/logo.svg`],
    },
  }),
];

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base], // baseSepolia first = default target chain
  connectors,
  ssr: true,
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

export const hasWalletConnect = true;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
