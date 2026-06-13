/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type-check + lint are validated separately (`tsc --noEmit`, `next lint`) and
  // are memory-heavy in-build; skip the in-build passes to keep the production
  // build within tight container memory limits.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { webpackBuildWorker: false },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  webpack: (config, { isServer }) => {
    // The client bundle now includes @solana/web3.js + @reown/appkit. The JS
    // minifier pushes peak memory past the container's cgroup limit (the build
    // gets SIGTERM'd) on low-RAM hosts like Codespaces. Disable client-side
    // minification to keep the build steady. Set MINIFY=1 to re-enable it on a
    // higher-memory build host (smaller bundles).
    if (!isServer && !process.env.MINIFY) config.optimization.minimize = false;

    // @solana/web3.js + WalletConnect reference optional/Node-only deps the
    // browser build never hits. Stub them so the client compile resolves cleanly.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
      url: false,
      assert: false,
      os: false,
      path: false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
