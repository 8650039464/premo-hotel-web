/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15+ security: dev resources (HMR, fast refresh) block ho jaate hain
  // agar browser 127.0.0.1 / 192.168.x.x se aaye aur server localhost pe bind ho.
  // Dev mein in origins ko whitelist karna zaroori hai warna hydration fail hoti hai.
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.56.1',
  ],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hotel-api-master.onrender.com',
      },
    ],
  },

  // Prod build me ESLint skip — lint locally karna ho to `npm run lint` chalao.
  // Ye Vercel deploys ko fast aur reliable rakhta hai (lint warnings se build
  // fail nahi hogi). Type-checking still happens via tsc.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
