/**
 * Frontend sanitization utilities.
 * Defence-in-depth: even though React auto-escapes JSX text,
 * we still sanitise untrusted values before they reach the DOM
 * or get stored in localStorage / sent to the backend.
 */

/**
 * Validate and sanitise a referral code from URL params / localStorage.
 * Only allows uppercase alphanumeric characters (max 20 chars).
 * Returns null if the input is invalid.
 */
export function sanitizeReferralCode(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    // Strip everything except A-Z, 0-9
    const cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 20)
    // Must be at least 4 chars to be a plausible code
    return cleaned.length >= 4 ? cleaned : null
}

/**
 * Validate that a URL is a safe image source.
 * Only allows https:// URLs. Blocks javascript:, data:, blob:, etc.
 */
export function sanitizeImageUrl(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()

    // Only allow https (never http, javascript, data, blob, vbscript…)
    if (!trimmed.startsWith('https://')) return null

    // Basic URL parse check
    try {
        const url = new URL(trimmed)
        if (url.protocol !== 'https:') return null
        return url.href
    } catch {
        return null
    }
}

/**
 * Sanitise user-controlled display text.
 * Strips control characters and limits length.
 * React's JSX auto-escapes HTML, but this adds a layer for
 * text that might end up in attributes or copied elsewhere.
 */
export function sanitizeDisplayText(raw: unknown, maxLength = 100): string {
    if (typeof raw !== 'string') return ''
    // Remove control chars (U+0000–U+001F except tab/newline) and zero-width chars
    return raw
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
        .trim()
        .slice(0, maxLength)
}

/**
 * Sanitise a wallet address.
 * Must be a valid 0x-prefixed 40-hex-char Ethereum address.
 * Returns null if invalid.
 */
export function sanitizeWallet(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return trimmed
    return null
}
