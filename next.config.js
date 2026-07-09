/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // isolated-vm is a native addon and Prisma ships its own engine binary;
    // keep both external so the server bundler doesn't try to bundle them.
    serverComponentsExternalPackages: ["isolated-vm", "@prisma/client"],
  },
};

module.exports = nextConfig;
