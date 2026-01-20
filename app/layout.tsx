import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
    title: 'Scratch Game',
    description: 'Scratch Card Game – Inspired by Childhood Lotteries. Play, donate, and compete on the leaderboard!',
    openGraph: {
        title: 'Scratch Game',
        description: 'Free-to-play scratch card game on Farcaster. Donate $1 USDC to become a Supporter!',
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
