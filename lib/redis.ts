import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import type { Duration } from '@upstash/ratelimit'
import { NextRequest } from 'next/server'

/**
 * Singleton Redis client — shared across all API routes.
 * Upstash Redis uses stateless HTTP requests (no TCP pool),
 * so a single instance is safe in serverless environments.
 * Prevents 12+ Redis.fromEnv() calls creating duplicate overhead.
 */
export const redis = Redis.fromEnv()

/**
 * Factory for rate limiters.
 * analytics: false to avoid doubling Redis writes per rate-limit check.
 */
export function createRateLimiter(limit: number, window: Duration) {
    return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, window),
        analytics: false,
    })
}

/**
 * Robust client IP extraction.
 * Tries multiple headers in priority order to avoid the 'anonymous'
 * shared-bucket problem where all users share one rate-limit key.
 * On Vercel, x-forwarded-for is always present.
 */
export function getClientIp(request: NextRequest): string {
    const xff = request.headers.get('x-forwarded-for')
    if (xff) return xff.split(',')[0].trim()
    return (
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        'unknown'
    )
}

/**
 * Leaderboard sorted-set key.
 * All score-mutating Lua scripts ZADD here so the leaderboard GET
 * becomes O(log N + K) instead of O(N).
 */
export const LEADERBOARD_KEY = 'leaderboard:scores'
export const LEADERBOARD_CACHE_KEY = 'leaderboard:cache'

/**
 * Point constants (single source of truth).
 */
export const POINTS = {
    easy: 3,
    medium: 5,
    hard: 10,
    dailyLogin: 2,
    supporterBonus: 50,
    referral: 10,
} as const

/**
 * Lua fragment: recalculate total score from player hash and ZADD
 * to the leaderboard sorted set. Append to any score-mutating Lua script.
 *
 * Expects variables in scope:
 *   `key`    — the player hash key (KEYS[n])
 *   Leaderboard sorted set key passed as a KEYS argument
 *   `walletLower` — player wallet (ARGV[n])
 *
 * Usage: pass the leaderboard KEYS index and wallet ARGV index:
 *   RECALC_SCORE_LUA('KEYS[2]', 'walletLower')
 */
export function makeRecalcScoreLua(lbKey: string, walletVar: string): string {
    return `
local _sv = redis.call('HMGET', key, 'easyWins', 'mediumWins', 'hardWins', 'dailyLoginPoints', 'supporterBonusClaimed', 'referralCount')
local _score = (tonumber(_sv[1]) or 0) * ${POINTS.easy} + (tonumber(_sv[2]) or 0) * ${POINTS.medium} + (tonumber(_sv[3]) or 0) * ${POINTS.hard} + (tonumber(_sv[4]) or 0)
if _sv[5] == 'true' or _sv[5] == '1' then _score = _score + ${POINTS.supporterBonus} end
_score = _score + (tonumber(_sv[6]) or 0) * ${POINTS.referral}
redis.call('ZADD', ${lbKey}, _score, ${walletVar})
`
}
