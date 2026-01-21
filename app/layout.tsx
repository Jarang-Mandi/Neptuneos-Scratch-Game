import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
    title: 'The Scratch Game',
    description: 'Free-to-play scratch card game on Base. Compete on the leaderboard and win the NFT!',
    icons: {
        icon: '/icon.png',
        apple: '/icon.png',
    },
    openGraph: {
        title: 'The Scratch Game',
        description: 'Free scratch card game on Base. Play, compete, and win the NFT!',
        images: ['/og-image.png'],
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="id" suppressHydrationWarning>
            <head>
                {/* Farcaster Frame v2 meta tags */}
                <meta name="fc:frame" content="vNext" />
                <meta name="fc:frame:image" content="https://neptuneos-scratch-game.vercel.app/og-image.png" />
                <meta name="fc:frame:button:1" content="Scratch and Win" />
                <meta name="fc:frame:button:1:action" content="launch_frame" />
                <meta name="fc:frame:button:1:target" content="https://neptuneos-scratch-game.vercel.app" />

                {/* Mini App embed meta tag */}
                <meta
                    name="fc:miniapp"
                    content='{"version":"next","imageUrl":"https://neptuneos-scratch-game.vercel.app/og-image.png","button":{"title":"Scratch and Win","action":{"type":"launch_frame","url":"https://neptuneos-scratch-game.vercel.app","splashImageUrl":"https://neptuneos-scratch-game.vercel.app/splash.png","splashBackgroundColor":"#0a1628"}}}'
                />

                <link rel="icon" href="/icon.png" type="image/png" />
                <link rel="apple-touch-icon" href="/icon.png" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Jersey+15&family=Jersey+20&display=swap" rel="stylesheet" />
            </head>
            <body>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    )
}
