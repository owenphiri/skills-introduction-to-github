/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // small Docker images; harmless on Vercel
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(self)',
        },
      ],
    },
    {
      // The service worker must never be cached aggressively.
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    },
  ],
};

export default nextConfig;
