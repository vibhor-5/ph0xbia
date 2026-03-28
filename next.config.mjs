/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Required for Phaser to work with Next.js
    config.externals = config.externals || [];
    return config;
  },
};

export default nextConfig;
