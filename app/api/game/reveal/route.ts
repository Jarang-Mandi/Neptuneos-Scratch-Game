import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { verifyGameToken, isValidWallet } from '@/lib/gameSession'
import { recordWin } from '@/lib/leaderboardHelper'
import { verifyAuthForWallet } from '@/lib/auth'

const redis = Redis.fromEnv()

/**
 * Lua script: atomic GET + reveal logic + SET/DEL in a SINGLE Redis round-trip.
 * Returns a JSON string with the reveal result so Node only pays 1 network hop.
 *
 * KEYS[1] = game:{gameId}
 * ARGV[1] = walletLower
 * ARGV[2] = cellIndex (string, will be tonumber'd)
 * ARGV[3] = session TTL in seconds (600)
 */
const REVEAL_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return '{"err":"expired"}' end

local session = cjson.decode(raw)

if session.wallet ~= ARGV[1] then return '{"err":"wallet"}' end
if session.status ~= 'active' then return '{"err":"ended"}' end

local idx = tonumber(ARGV[2])
if idx < 0 or idx >= #session.cells then return '{"err":"bounds"}' end

-- Check already revealed
for _, v in ipairs(session.revealedIndices) do
  if v == idx then return '{"err":"revealed"}' end
end

local cell = session.cells[idx + 1]  -- Lua is 1-indexed
table.insert(session.revealedIndices, idx)

if cell.isBomb then
  -- LOSS: delete session, return full board
  redis.call('DEL', KEYS[1])
  return cjson.encode({
    hit = 'bomb',
    emoji = cell.emoji,
    allCells = session.cells,
    level = session.level
  })
end

-- Count safe cells
local totalSafe = 0
for _, c in ipairs(session.cells) do
  if not c.isBomb then totalSafe = totalSafe + 1 end
end
local revealedSafe = 0
for _, ri in ipairs(session.revealedIndices) do
  if not session.cells[ri + 1].isBomb then revealedSafe = revealedSafe + 1 end
end

if revealedSafe >= totalSafe then
  -- WIN: delete session, return full board + level for scoring
  redis.call('DEL', KEYS[1])
  return cjson.encode({
    hit = 'win',
    emoji = cell.emoji,
    allCells = session.cells,
    level = session.level
  })
end

-- CONTINUE: update session
session.status = 'active'
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', tonumber(ARGV[3]))
return cjson.encode({
  hit = 'safe',
  emoji = cell.emoji
})
`

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { gameId, token, wallet, cellIndex } = body

        // --- Lightweight local validation (no Redis) ---
        if (!gameId || typeof gameId !== 'string') {
            return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 })
        }
        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
        }
        if (!wallet || !isValidWallet(wallet)) {
            return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
        }

        const auth = verifyAuthForWallet(request, wallet)
        if (!auth.authenticated) {
            return NextResponse.json({ error: auth.error }, { status: 401 })
        }

        if (typeof cellIndex !== 'number' || cellIndex < 0) {
            return NextResponse.json({ error: 'Invalid cell index' }, { status: 400 })
        }

        const walletLower = wallet.toLowerCase()

        // HMAC check — local crypto, no network
        if (!verifyGameToken(gameId, walletLower, token)) {
            return NextResponse.json({ error: 'Invalid game token' }, { status: 403 })
        }

        // === Single Redis round-trip: Lua script does GET + logic + SET/DEL ===
        const luaResult = await redis.eval(
            REVEAL_LUA,
            [`game:${gameId}`],
            [walletLower, cellIndex, 600]
        ) as string

        const result = JSON.parse(typeof luaResult === 'string' ? luaResult : JSON.stringify(luaResult))

        // Handle Lua error codes
        if (result.err) {
            const errMap: Record<string, { msg: string; status: number }> = {
                expired: { msg: 'Game session expired or not found', status: 404 },
                wallet:  { msg: 'Wallet mismatch', status: 403 },
                ended:   { msg: 'Game already ended', status: 400 },
                bounds:  { msg: 'Cell index out of bounds', status: 400 },
                revealed:{ msg: 'Cell already revealed', status: 400 },
            }
            const e = errMap[result.err] || { msg: 'Unknown error', status: 500 }
            return NextResponse.json({ error: e.msg }, { status: e.status })
        }

        // === BOMB HIT — LOSS ===
        if (result.hit === 'bomb') {
            return NextResponse.json({
                cellResult: { emoji: '💣', isBomb: true },
                gameOver: true,
                won: false,
                allCells: result.allCells
            })
        }

        // === WIN ===
        if (result.hit === 'win') {
            // recordWin is a separate Redis call but only happens once per game
            const winResult = await recordWin(walletLower, result.level)

            return NextResponse.json({
                cellResult: { emoji: result.emoji, isBomb: false },
                gameOver: true,
                won: true,
                allCells: result.allCells,
                pointsEarned: winResult.pointsEarned,
                dailyWinsRemaining: winResult.dailyWinsRemaining,
                limitReached: winResult.limitReached
            })
        }

        // === SAFE — game continues ===
        return NextResponse.json({
            cellResult: { emoji: result.emoji, isBomb: false },
            gameOver: false,
            won: false
        })
    } catch (error) {
        console.error('Game reveal error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
