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
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
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
