# Neptuneos Scratch Game (Next.js + Farcaster)

Scratch Card Mini App untuk Farcaster dengan fitur:
- ✅ Free to play (unlimited)
- 💰 $1 USDC donation → Supporter badge + FCFS free NFT mint
- 🏆 Leaderboard per level (Top 100)
- 🎁 Top 350 players → Free Whitelist

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Setup Checklist

### 1. Environment Variables
Copy `.env.local` and fill in:
- `NEXT_PUBLIC_DONATION_RECEIVER` → Your wallet address

### 2. Vercel Postgres (Optional for Production)
1. Go to Vercel Dashboard > Storage > Create Database
2. Copy connection strings to `.env.local`
3. Run migrations (schema in `implementation_plan.md`)

### 3. Deploy Smart Contract
1. Use Remix or Hardhat to deploy `contracts/ScratchGameDonation.sol`
2. Update `NEXT_PUBLIC_GAME_CONTRACT` in `.env.local`

### 4. Farcaster Manifest
Update `public/.well-known/farcaster.json`:
- Replace `your-domain.com` with your actual domain
- Generate proper `accountAssociation` using Farcaster tools

### 5. Deploy to Vercel
```bash
npm install -g vercel
vercel
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/leaderboard` | GET | Get leaderboard by level |
| `/api/game/record` | POST | Record game win/loss |
| `/api/donate` | POST | Record donation |
| `/api/export` | GET | Export supporters or top 350 |

## Export for NFT Distribution

```bash
# Get supporters list
curl https://your-domain.com/api/export?type=supporters&format=csv

# Get top 350 for whitelist
curl https://your-domain.com/api/export?type=top350&format=csv
```

## Tech Stack
- Next.js 15 + TypeScript
- Farcaster Mini App SDK
- Wagmi + Viem (Base chain)
- Vercel Serverless
