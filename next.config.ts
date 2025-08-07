// next.config.js
module.exports = {
  experimental: {
    serverActions: true,
  },
  // 👇 prevent static generation on auth redirect routes
  async headers() {
    return [
      {
        source: '/auth/callback',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}
