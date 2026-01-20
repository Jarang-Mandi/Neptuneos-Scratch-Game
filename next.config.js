/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Allow loading external fonts
    images: {
        domains: ['fonts.googleapis.com', 'fonts.gstatic.com'],
    },
}

module.exports = nextConfig
