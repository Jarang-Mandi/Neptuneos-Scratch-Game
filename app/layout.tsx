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
                <meta name="fc:frame" content="vNext" />
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
