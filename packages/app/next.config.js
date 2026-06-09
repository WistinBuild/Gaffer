/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  webpack: (config) => {
    // wagmi / WalletConnect / Coinbase SDK reference optional deps that aren't
    // needed in the browser build. Stub them so webpack doesn't fail to resolve.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
