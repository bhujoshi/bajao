/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/**": ["./prisma/dev.db", "./node_modules/.prisma/client/**"],
    },
  },
};

export default nextConfig;

