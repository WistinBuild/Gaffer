"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { solanaAdapter, solanaDefaultNetwork } from "@/lib/solana";
import { useState } from "react";

// Inlined here (not imported from lib/wagmi) so the EVM wagmi adapter stays out
// of the client bundle entirely.
const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "ab78ba5feac2c3132c4e017649e93f91";
const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gaffer.games";

// Reown AppKit — the unified "Connect Wallet" modal. The on-chain layer is on
// Solana devnet, so the modal is Solana-only (the EVM/wagmi adapter has been
// removed now that all reads/writes go through the Anchor programs).
createAppKit({
  adapters: [solanaAdapter],
  projectId: wcProjectId,
  networks: [solanaDefaultNetwork],
  defaultNetwork: solanaDefaultNetwork,
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
