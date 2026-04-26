/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cuxuqsnbxwuhdeajrjcz.supabase.co' }
    ]
  },
  experimental: { typedRoutes: false }
};

module.exports = nextConfig;
