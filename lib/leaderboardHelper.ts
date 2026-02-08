import { Redis } from '@upstash/redis'

const LEVEL_POINTS: Record<string, number> = {
    easy: 3,
    medium: 5,
    hard: 10
}

const DAILY_WIN_LIMIT = 10

const redis = Redis.fromEnv()

function getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]
}

export interface RecordWinResult {
    success: boolean
    limitReached?: boolean
    pointsEarned?: number
    dailyWinsRemaining?: number
    error?: string
}

/**
 * Lua script: atomic daily-win-limit check + win recording.
 * Prevents race condition where concurrent reveals bypass the daily limit.
 * Only touches the fields it needs — won't overwrite unrelated fields.
 */
const RECORD_WIN_LUA = `
local key = KEYS[1]
local today = ARGV[1]
local level = ARGV[2]
local dailyLimit = tonumber(ARGV[3])
local walletLower = ARGV[4]

local dailyWinDate = redis.call('HGET', key, 'dailyWinDate')
local dailyWinCount = tonumber(redis.call('HGET', key, 'dailyWinCount')) or 0

if not dailyWinDate or dailyWinDate ~= today then
  dailyWinCount = 0
end

if dailyWinCount >= dailyLimit then
  return 'LIMIT:0'
end

local levelField = level .. 'Wins'
local currentWins = tonumber(redis.call('HGET', key, levelField)) or 0
redis.call('HSET', key, levelField, currentWins + 1)

local newCount = dailyWinCount + 1
redis.call('HSET', key, 'dailyWinCount', newCount)
redis.call('HSET', key, 'dailyWinDate', today)

local w = redis.call('HGET', key, 'wallet')
if not w or w == '' then
  redis.call('HSET', key, 'wallet', walletLower)
end

return 'OK:' .. (dailyLimit - newCount)
`

/**
 * Record a game win for a player. Handles daily win limits and point calculation.
 * Uses a Lua script so the limit-check + increment is atomic (no race conditions).
 * Called internally by the game reveal endpoint — NOT from the client.
 */
export async function recordWin(wallet: string, level: string): Promise<RecordWinResult> {
    const walletLower = wallet.toLowerCase()
    const key = `player:${walletLower}`
    const today = getTodayDateString()

    const result = await redis.eval(
        RECORD_WIN_LUA,
        [key],
        [today, level, DAILY_WIN_LIMIT, walletLower]
    ) as string

    const resultStr = String(result)

    if (resultStr.startsWith('LIMIT')) {
        return {
            success: false,
            limitReached: true,
            dailyWinsRemaining: 0,
            error: 'Daily win limit reached'
        }
    }

    const remaining = parseInt(resultStr.split(':')[1], 10)

    return {
        success: true,
        pointsEarned: LEVEL_POINTS[level] || 0,
        dailyWinsRemaining: remaining
    }
}
