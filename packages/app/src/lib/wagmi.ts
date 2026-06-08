import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { base, baseSepolia } from "./chains";

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(), // picks up Coinbase Wallet, MetaMask, Rabby, etc.
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
