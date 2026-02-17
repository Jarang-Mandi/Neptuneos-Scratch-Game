/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Allow loading external fonts
    images: {
        domains: ['fonts.googleapis.com', 'fonts.gstatic.com'],
    },
    // Security headers for all routes
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    // Use frame-ancestors instead of X-Frame-Options so Farcaster
                    // and Base can embed the app in iframes.
                    // X-Frame-Options: SAMEORIGIN blocks ALL cross-origin iframes.
                    {
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors 'self' https://farcaster.xyz https://*.farcaster.xyz https://warpcast.com https://*.warpcast.com https://base.org https://*.base.org https://base.dev https://*.base.dev https://onchainkit.xyz https://*.onchainkit.xyz https://vercel.app https://*.vercel.app",
                    },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                ],
            },
        ]
    },
}

module.exports = nextConfig
