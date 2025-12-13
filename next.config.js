/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.med-armour.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'med-armour.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.goindigo.in',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'goindigo.in',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig


