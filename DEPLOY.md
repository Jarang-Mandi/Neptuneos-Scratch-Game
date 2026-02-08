# 🚀 NeptuneOS Scratch Game — Vercel Deployment Guide

Panduan deploy lengkap setelah **Security Audit Phase 1–4** selesai.

---

## Prerequisites

- Akun [Vercel](https://vercel.com)
- Akun [Upstash](https://upstash.com) (Redis)
- Repository Git (GitHub / GitLab / Bitbucket)
- Smart contract sudah di-deploy di **Base Mainnet**

---

## 1. Push ke Git Repository

```bash
cd Neptuneos-Scratch-Game-main

# Pastikan .env.local TIDAK ke-push (cek .gitignore)
echo ".env.local" >> .gitignore

git add .
git commit -m "security: complete phase 1-4 hardening"
git push origin main
```

---

## 2. Import Project di Vercel

1. Buka [vercel.com/new](https://vercel.com/new)
2. **Import** dari Git repository
3. Framework Preset: **Next.js** (otomatis terdeteksi)
4. Build Settings (biarkan default):
   - Build Command: `next build`
   - Output Directory: `.next`
   - Install Command: `npm install`
5. Klik **Deploy** (akan gagal dulu karena belum ada env vars — lanjut ke step 3)

---

## 3. Set Environment Variables

Buka **Project Settings → Environment Variables** dan tambahkan:

### 🔴 WAJIB — Server Secrets (generate yang baru!)

Buka terminal dan jalankan:

```bash
# Generate GAME_SECRET
openssl rand -hex 32
# Contoh output: 7a3f2c... (64 karakter hex)

# Generate ADMIN_KEY
openssl rand -hex 32
# Contoh output: b9e1d4... (64 karakter hex)
```

| Variable | Value | Environment |
|----------|-------|-------------|
| `GAME_SECRET` | *(hasil openssl rand -hex 32)* | Production, Preview |
| `ADMIN_KEY` | *(hasil openssl rand -hex 32)* | Production |

> ⚠️ **JANGAN** pakai value default dari `.env.local`! Itu placeholder development.

### 🔵 Upstash Redis

Opsi A — **Vercel Integration** (recommended):
1. Buka **Project Settings → Integrations**
2. Cari **Upstash** → **Add Integration**
3. Buat atau hubungkan Redis database
4. Variable `KV_REST_API_URL` dan `KV_REST_API_TOKEN` otomatis terisi

Opsi B — **Manual**:

| Variable | Value | Environment |
|----------|-------|-------------|
| `KV_REST_API_URL` | `https://xxxxx.upstash.io` | Production, Preview |
| `KV_REST_API_TOKEN` | *(dari Upstash dashboard)* | Production, Preview |
| `KV_REST_API_READ_ONLY_TOKEN` | *(dari Upstash dashboard)* | Production, Preview |
| `REDIS_URL` | `rediss://default:xxx@xxx.upstash.io:6379` | Production, Preview |

### 🟢 Public Variables (Smart Contract)

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_URL` | `https://your-domain.vercel.app` | Production |
| `NEXT_PUBLIC_GAME_CONTRACT` | `0xeA404b1F2073CA19648C3Fa92a2A36F6AE3c42ed` | Production, Preview |
| `NEXT_PUBLIC_DONATION_RECEIVER` | `0xF6faAD8A41c791BC3f97F3D97540BacA44535ed3` | Production, Preview |

---

## 4. Redeploy

Setelah semua env vars diisi:
1. Buka **Deployments** tab
2. Klik deployment terbaru → **⋮ → Redeploy**
3. Tunggu build selesai (~1-2 menit)

---

## 5. Verifikasi Deployment

### Cek halaman utama
```
https://your-domain.vercel.app
```

### Cek API endpoints berjalan
```bash
# Leaderboard (public, no auth)
curl https://your-domain.vercel.app/api/leaderboard

# Auth nonce (should return nonce)
curl https://your-domain.vercel.app/api/auth/nonce

# Export (harus 401 tanpa admin key)
curl https://your-domain.vercel.app/api/export
# Expected: {"error":"Missing admin key"}

# Export (dengan admin key)
curl -H "x-admin-key: YOUR_ADMIN_KEY" https://your-domain.vercel.app/api/export
```

---

## 6. Domain & SSL

### Custom Domain (opsional)
1. **Project Settings → Domains**
2. Tambahkan domain → ikuti instruksi DNS (CNAME/A record)
3. SSL otomatis dari Vercel

### Update NEXT_PUBLIC_URL
Jika pakai custom domain, update env var:
```
NEXT_PUBLIC_URL=https://yourgame.com
```

---

## 7. Monitoring

### Vercel Dashboard
- **Logs**: Real-time function logs → cek error API
- **Analytics**: Vercel Analytics (gratis basic)
- **Speed Insights**: Core Web Vitals

### Upstash Dashboard
- **Data Browser**: Lihat isi Redis (`player:*`, `game:*`, dll)
- **Analytics**: Request count, latency

---

## Architecture Summary (Post-Security Audit)

```
Browser (React)
  │
  ├─ Wallet Sign-In (EIP-191) ──→ /api/auth/nonce + /api/auth/login
  │                                  │
  │                                  └─ HMAC session token (24h TTL)
  │
  ├─ Start Game ──→ /api/game/start   [auth required]
  │                    └─ Generates game server-side, stores in Redis
  │
  ├─ Reveal Cell ──→ /api/game/reveal  [auth required]
  │                    └─ Atomic Lua: daily limit check + win record
  │
  ├─ Daily Login ──→ /api/quest/daily-login [auth required]
  │                    └─ Atomic Lua: cooldown check + point award
  │
  ├─ Referral ──→ /api/quest/referral  [auth required]
  │                 └─ Atomic Lua: 2-key referral registration
  │
  ├─ Donate ──→ /api/donate  [auth + on-chain verify]
  │               └─ Atomic Lua: supporter registration
  │
  ├─ Profile ──→ /api/profile  [auth for POST]
  │               └─ Atomic Lua: supporter bonus claim
  │
  └─ Export ──→ /api/export  [admin key required]
```

---

## Security Checklist Sebelum Go-Live

- [ ] `GAME_SECRET` sudah diganti (bukan placeholder)
- [ ] `ADMIN_KEY` sudah diganti (bukan placeholder)
- [ ] `.env.local` tidak ada di Git repository
- [ ] Upstash Redis credentials benar
- [ ] Smart contract address benar (`0xeA404...`)
- [ ] `NEXT_PUBLIC_URL` sudah mengarah ke production URL
- [ ] Test: game start → reveal → win/lose flow berjalan
- [ ] Test: daily login claim works
- [ ] Test: export endpoint returns 401 tanpa key
- [ ] Test: API returns 401 tanpa auth token

---

## Troubleshooting

### Build Error: "Module not found"
```bash
# Pastikan semua dependencies terinstall
npm install
npm run build
```

### API Error 500: Redis connection
- Cek env vars `KV_REST_API_URL` dan `KV_REST_API_TOKEN` di Vercel
- Pastikan Upstash Redis region dekat dengan Vercel region (recommended: `us-east-1`)

### Auth Error: "Invalid signature"
- Pastikan `GAME_SECRET` sama di semua deployments
- Jangan mengubah `GAME_SECRET` setelah users login (akan invalidate semua session)

### Game Not Starting
- Cek Vercel Function Logs untuk error detail
- Pastikan `GAME_SECRET` env var sudah di-set

### Farcaster Mini App
- App perlu di-register di [Farcaster Developer Portal](https://docs.farcaster.xyz/)
- `NEXT_PUBLIC_URL` harus HTTPS
