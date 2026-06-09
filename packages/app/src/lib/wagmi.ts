import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { base, baseSepolia } from "./chains";

// WalletConnect needs a projectId from https://cloud.reown.com (formerly
// WalletConnect Cloud). It's only registered when the env var is present.
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const connectors = [
  injected({ shimDisconnect: true }), // MetaMask / Rabby / browser extensions
  coinbaseWallet({ appName: "Gaffer", preference: "all" }),
  ...(wcProjectId
    ? [
        walletConnect({
          projectId: wcProjectId,
          showQrModal: true,
          metadata: {
            name: "Gaffer",
            description: "On-chain fantasy football manager",
            url: appUrl,
            icons: [`${appUrl}/logo.svg`],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors,
  ssr: true,
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

export const hasWalletConnect = Boolean(wcProjectId);

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
