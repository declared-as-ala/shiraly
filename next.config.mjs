/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
    minimumCacheTTL: 86400,
  },
  experimental: {
    serverActions: { allowedOrigins: ['*'] },
    // `soap` does dynamic requires (WSDL/templates) — keep it external so it's
    // loaded at runtime from node_modules instead of being bundled.
    serverComponentsExternalPackages: ['soap'],
  },
};
export default nextConfig;
