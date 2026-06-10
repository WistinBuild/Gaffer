"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { wagmiAdapter, wagmiConfig, wcProjectId, networks, defaultNetwork, appUrl } from "@/lib/wagmi";
import { ChainGuard } from "@/components/ChainGuard";
import { useState } from "react";

// Reown AppKit — the unified "Connect Wallet" modal (WalletConnect + injected
// wallets in one branded popup). Created once at module scope; defaults the
// network to Base mainnet (in sync with lib/chains.ts activeChain). Wallet-only
// (no email/social login).
createAppKit({
  adapters: [wagmiAdapter],
  projectId: wcProjectId,
  networks,
  defaultNetwork,
  metadata: {
    name: "Gaffer",
    description: "On-chain fantasy football manager",
    url: appUrl,
    icons: [`${appUrl}/logo.svg`],
  },
  features: { analytics: false, email: false, socials: [] },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#D4AF37",
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ChainGuard />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
