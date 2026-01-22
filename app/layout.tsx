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
        images: ['https://neptuneos-scratch-game.vercel.app/og-image.png'],
    },
    other: {
        'base:app_id': 'f0bf111f81bd086f034ac7f4f7',
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
                {/* Farcaster Mini App Embed - must have stringified JSON */}
                <meta
                    name="fc:frame"
                    content='{"version":"1","imageUrl":"https://neptuneos-scratch-game.vercel.app/og-image.png","button":{"title":"Scratch and Win","action":{"type":"launch_frame","name":"The Scratch Game","url":"https://neptuneos-scratch-game.vercel.app","splashImageUrl":"https://neptuneos-scratch-game.vercel.app/splash.png","splashBackgroundColor":"#0a1628"}}}'
                />
                <meta
                    name="fc:miniapp"
                    content='{"version":"1","imageUrl":"https://neptuneos-scratch-game.vercel.app/og-image.png","button":{"title":"Scratch and Win","action":{"type":"launch_frame","name":"The Scratch Game","url":"https://neptuneos-scratch-game.vercel.app","splashImageUrl":"https://neptuneos-scratch-game.vercel.app/splash.png","splashBackgroundColor":"#0a1628"}}}'
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
