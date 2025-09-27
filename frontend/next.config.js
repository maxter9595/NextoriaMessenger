/** @type {import('next').NextConfig} */

require('dotenv').config({ path: '../.env' });

const nextConfig = {
  env: {
    FRONTEND_URL: process.env.FRONTEND_URL,
    BACKEND_URL: process.env.BACKEND_URL,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL}/api/:path*`
      }
    ]
  }
}

module.exports = nextConfig;