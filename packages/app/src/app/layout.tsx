import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PageTransition } from "@/components/ui/PageTransition";
import { MusicPlayer } from "@/components/ui/MusicPlayer";
import { PitchSplash } from "@/components/ui/PitchSplash";

export const viewport: Viewport = {
  themeColor: "#080B0F",
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
    "Draft 5 World Cup 2026 players as NFTs. Stake ETH. Outscore your opponent on matchday. Live on Base.",
  applicationName: "GAFFER",
  keywords: [
    "Base",
    "Base",
    "fantasy football",
    "World Cup 2026",
    "NFT",
    "on-chain game",
    "web3 gaming",
    "ETH",
  ],
  authors: [{ name: "GAFFER" }],
  openGraph: {
    title: "GAFFER — On-chain Fantasy Football",
    description:
      "Draft 5 World Cup 2026 players. Stake ETH. Outscore your opponent. Live on Base.",
    siteName: "GAFFER",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "GAFFER — On-chain Fantasy Football",
    description:
      "Draft 5 World Cup 2026 players. Stake ETH. Outscore your opponent. Live on Base.",
    creator: "@gaffergg",
  },
  robots: { index: true, follow: true },
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
