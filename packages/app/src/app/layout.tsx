import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PageTransition } from "@/components/ui/PageTransition";
import { MusicPlayer } from "@/components/ui/MusicPlayer";
import { PitchSplash } from "@/components/ui/PitchSplash";

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "GAFFER — On-chain Fantasy Football",
    template: "%s · GAFFER",
  },
  description:
    "Draft 5 World Cup 2026 players as NFTs. Stake USDC. Outscore your opponent on matchday. Live on Solana.",
  applicationName: "GAFFER",
  keywords: [
    "Solana",
    "Solana devnet",
    "fantasy football",
    "World Cup 2026",
    "NFT",
    "on-chain game",
    "web3 gaming",
    "USDC",
  ],
  authors: [{ name: "GAFFER" }],
  openGraph: {
    title: "GAFFER — On-chain Fantasy Football",
    description:
      "Draft 5 World Cup 2026 players as NFTs. Stake USDC. Outscore your rival on matchday. Live on Solana.",
    siteName: "GAFFER",
    type: "website",
    locale: "en_US",
    url: "/",
    images: [
      { url: "/solana-live.jpg", width: 1600, height: 900, alt: "GAFFER — on-chain fantasy football, live on Solana" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GAFFER — On-chain Fantasy Football",
    description:
      "Draft players as NFTs. Stake USDC. Outscore your rival. Forge Bronze → Icon. Live on Solana.",
    site: "@gaffer_game",
    creator: "@gaffer_game",
    images: ["/solana-live.jpg"],
  },
  robots: { index: true, follow: true },
  // Base App (base.dev) domain-ownership verification — renders
  // <meta name="base:app_id" content="…"> in <head> on every page.
  other: { "base:app_id": "6a29436a65478aa1565a96ad" },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Providers>
          <PageTransition>{children}</PageTransition>
          <MusicPlayer />
          <PitchSplash />
        </Providers>
      </body>
    </html>
  );
}
