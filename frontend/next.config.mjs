/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false, // Phaser doesn't play well with strict mode double-render
};

export default nextConfig;
