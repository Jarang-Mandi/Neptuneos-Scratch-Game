'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { sanitizeDisplayText } from '@/lib/sanitize'

const emojis = ["🍒", "⭐", "🍀", "🔔", "🥇", "🍉", "🍇", "🍎", "🎁", "🎉"]

interface ValidLevels {
    [key: string]: { size: number; bombs: number }
}

const validLevels: ValidLevels = {
    easy: { size: 3, bombs: 1 },
    medium: { size: 4, bombs: 1 },
    hard: { size: 5, bombs: 2 }
}

interface ScratchGameProps {
    wallet?: string
    getAuthHeaders?: () => Record<string, string>
    onWin?: (level: string, pointsEarned?: number, dailyWinsRemaining?: number) => void
    onLose?: (level: string) => void
}

const levelOptions = [
    { value: 'easy', label: 'Easy', grid: '3×3', emoji: '🟢', bombs: 1 },
    { value: 'medium', label: 'Medium', grid: '4×4', emoji: '🟡', bombs: 1 },
    { value: 'hard', label: 'Hard', grid: '5×5', emoji: '🔴', bombs: 2 }
]

export default function ScratchGame({ wallet, getAuthHeaders, onWin, onLose }: ScratchGameProps) {
    const [level, setLevel] = useState<string>('easy')
    const [gameActive, setGameActive] = useState(false)
    const [message, setMessage] = useState('')
    const [cells, setCells] = useState<{ emoji: string; revealed: boolean; isBomb: boolean }[]>([])
    const [canRestart, setCanRestart] = useState(true)
    const [isMuted, setIsMuted] = useState(false)
    const [showRules, setShowRules] = useState(true)
    const [isLightMode, setIsLightMode] = useState(false)
    const [gameKey, setGameKey] = useState(0) // Key to force re-render of cells
    const [dropdownOpen, setDropdownOpen] = useState(false)

    const bgmRef = useRef<HTMLAudioElement>(null)
    const winSoundRef = useRef<HTMLAudioElement>(null)
    const loseSoundRef = useRef<HTMLAudioElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Server-side game session refs (not state to avoid stale closures)
    const gameIdRef = useRef<string | null>(null)
    const gameTokenRef = useRef<string | null>(null)
    const gameActiveRef = useRef(false)
    const pendingRevealsRef = useRef<Set<number>>(new Set())

    // Keep getAuthHeaders in a ref so it's always fresh inside callbacks
    const getAuthHeadersRef = useRef(getAuthHeaders)
    useEffect(() => {
        getAuthHeadersRef.current = getAuthHeaders
    }, [getAuthHeaders])

    const levelConfig = validLevels[level]
    const gSize = levelConfig.size
    const totalBombs = levelConfig.bombs
    const totCells = gSize * gSize
    const currentLevel = levelOptions.find(l => l.value === level)!

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Initialize theme from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('theme') || 'dark'
        setIsLightMode(saved === 'light')
        if (saved === 'light') {
            document.body.classList.add('light-mode')
        }
    }, [])

    // Reset cells when level changes (fix for grid not updating after game end)
    useEffect(() => {
        setCells([])
        setMessage('')
        setGameActive(false)
        gameActiveRef.current = false
        gameIdRef.current = null
        gameTokenRef.current = null
        pendingRevealsRef.current = new Set()
    }, [level])

    const toggleTheme = () => {
        const newMode = !isLightMode
        setIsLightMode(newMode)
        if (newMode) {
            document.body.classList.add('light-mode')
            localStorage.setItem('theme', 'light')
        } else {
            document.body.classList.remove('light-mode')
            localStorage.setItem('theme', 'dark')
        }
    }

    const playBgm = useCallback(() => {
        if (bgmRef.current) {
            bgmRef.current.volume = 0.5
            // Try to play - this will work after user interaction
            const playPromise = bgmRef.current.play()
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsMuted(false)
                    })
                    .catch(err => {
                        console.warn('BGM autoplay blocked by browser:', err.message)
                        // Don't set muted - user can click Music button to start
                    })
            }
        }
    }, [])

    const toggleMusic = () => {
        if (bgmRef.current) {
            if (bgmRef.current.paused) {
                bgmRef.current.play().catch(err => console.warn('BGM play failed:', err))
                setIsMuted(false)
            } else {
                bgmRef.current.pause()
                setIsMuted(true)
            }
        }
    }

    const startGame = useCallback(async () => {
        if (!canRestart || !wallet) return
        setCanRestart(false)

        try {
            // Request new game session from server
            const res = await fetch('/api/game/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeadersRef.current?.() },
                body: JSON.stringify({ wallet, level })
            })

            if (!res.ok) {
                const data = await res.json()
                setMessage(sanitizeDisplayText(data.error, 120) || 'Failed to start game')
                return
            }

            const data = await res.json()

            // Store server game session (refs to avoid stale closures)
            gameIdRef.current = data.gameId
            gameTokenRef.current = data.token
            pendingRevealsRef.current = new Set()

            // Force re-mount all cells
            setGameKey(prev => prev + 1)

            // Create cells with hidden content (server decides what's behind each cell)
            const emptyCells = Array.from({ length: data.totalCells }, () => ({
                emoji: '❓',
                revealed: false,
                isBomb: false
            }))
            setCells(emptyCells)
            setMessage('')
            setGameActive(true)
            gameActiveRef.current = true

            // Play BGM
            if (bgmRef.current) {
                bgmRef.current.currentTime = 0
                playBgm()
            }
        } catch (error) {
            console.error('Failed to start game:', error)
            setMessage('Failed to start game. Try again.')
        } finally {
            setTimeout(() => setCanRestart(true), 500)
        }
    }, [canRestart, wallet, level, playBgm])

    const revealCell = useCallback(async (idx: number) => {
        // Use refs to avoid stale closure issues with async operations
        if (!gameActiveRef.current) return
        if (pendingRevealsRef.current.has(idx)) return
        if (!gameIdRef.current || !gameTokenRef.current || !wallet) return

        pendingRevealsRef.current.add(idx)

        // === Optimistic UI: show revealing state immediately ===
        setCells(prev => {
            const newCells = [...prev]
            newCells[idx] = { ...newCells[idx], emoji: '⏳', revealed: true }
            return newCells
        })

        try {
            // Ask server what's behind this cell
            const res = await fetch('/api/game/reveal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeadersRef.current?.() },
                body: JSON.stringify({
                    gameId: gameIdRef.current,
                    token: gameTokenRef.current,
                    wallet,
                    cellIndex: idx
                })
            })

            if (!res.ok) {
                // Revert optimistic reveal on error
                setCells(prev => {
                    const newCells = [...prev]
                    newCells[idx] = { emoji: '❓', revealed: false, isBomb: false }
                    return newCells
                })
                console.error('Reveal error:', (await res.json()).error)
                return
            }

            const data = await res.json()

            if (data.gameOver) {
                // Game ended — server reveals entire board
                gameActiveRef.current = false
                setGameActive(false)

                if (data.allCells) {
                    setCells(data.allCells.map((c: { emoji: string; isBomb: boolean }) => ({
                        emoji: c.isBomb ? '💣' : c.emoji,
                        revealed: true,
                        isBomb: c.isBomb
                    })))
                }

                setMessage(data.won ? '🎉 You Win!' : '💥 NOOB! You Lose!')

                if (bgmRef.current) bgmRef.current.pause()

                if (!isMuted) {
                    const sound = data.won ? winSoundRef.current : loseSoundRef.current
                    sound?.play().catch(err => console.warn('Sound play failed:', err))
                }

                if (data.won) {
                    onWin?.(level, data.pointsEarned, data.dailyWinsRemaining)
                } else {
                    onLose?.(level)
                }
            } else {
                // Safe cell — update with actual emoji from server
                setCells(prev => {
                    const newCells = [...prev]
                    newCells[idx] = {
                        emoji: data.cellResult.emoji,
                        revealed: true,
                        isBomb: false
                    }
                    return newCells
                })
            }
        } catch (error) {
            // Revert optimistic reveal on network failure
            setCells(prev => {
                const newCells = [...prev]
                newCells[idx] = { emoji: '❓', revealed: false, isBomb: false }
                return newCells
            })
            console.error('Reveal failed:', error)
        } finally {
            pendingRevealsRef.current.delete(idx)
        }
    }, [wallet, level, isMuted, onWin, onLose])

    const closeRules = () => {
        setShowRules(false)
        playBgm()
    }

    return (
        <>
            {/* Popup Rules */}
            {showRules && (
                <div className="popup-overlay">
                    <div className="popup-content">
                        <button className="popup-close" onClick={closeRules}>✖</button>
                        <h2>📜 Game Rules</h2>
                        <p>
                            🔹 Scratch all the circles without hitting the bomb 💣<br />
                            🔹 Easy & Medium: one bomb in the circle 💣<br />
                            🔹 Hard: two bomb in the circle 💣💣<br /><br />
                            Let&apos;s Play The Game 🎮
                        </p>
                    </div>
                </div>
            )}

            <div className="container">
                <h1>Scratch Game</h1>

                <div id="difficulty" style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Custom Dropdown */}
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => !gameActive && setDropdownOpen(!dropdownOpen)}
                            disabled={gameActive}
                            style={{
                                padding: '10px 20px',
                                minWidth: '160px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                background: 'linear-gradient(145deg, #00c6ff, #0072ff)',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                cursor: gameActive ? 'not-allowed' : 'pointer',
                                opacity: gameActive ? 0.6 : 1,
                                boxShadow: '0 4px #005bb5',
                                transition: 'all 0.15s ease-in-out'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{currentLevel.emoji}</span>
                                <span>{currentLevel.label}</span>
                                <span style={{ fontSize: '12px', opacity: 0.8 }}>({currentLevel.grid})</span>
                            </span>
                            <span style={{ fontSize: '10px', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                        </button>

                        {/* Dropdown Menu */}
                        {dropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                minWidth: '200px',
                                marginTop: '8px',
                                background: 'linear-gradient(145deg, #0f2027, #203a43)',
                                border: 'none',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                zIndex: 100,
                                padding: '8px'
                            }}>
                                {levelOptions.map((opt, idx) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            setLevel(opt.value)
                                            setDropdownOpen(false)
                                        }}
                                        style={{
                                            width: 'calc(100% - 0px)',
                                            padding: '10px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            background: level === opt.value ? 'linear-gradient(145deg, #00c6ff, #0072ff)' : 'transparent',
                                            border: 'none',
                                            borderRadius: '8px',
                                            marginBottom: idx < levelOptions.length - 1 ? '4px' : '0',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            boxShadow: level === opt.value ? '0 4px #005bb5' : 'none',
                                            fontWeight: 'bold',
                                            fontSize: '14px'
                                        }}
                                    >
                                        <span style={{ fontSize: '18px' }}>{opt.emoji}</span>
                                        <div style={{ flex: 1 }}>
                                            <div>{opt.label}</div>
                                            <div style={{ fontSize: '11px', opacity: 0.7 }}>{opt.grid} • 💣×{opt.bombs}</div>
                                        </div>
                                        {level === opt.value && <span>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button id="startBtn" onClick={startGame} disabled={gameActive && canRestart} style={{ height: '41px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {cells.length > 0 && !gameActive ? 'Play Again' : 'Play Game'}
                    </button>
                </div>

                <div
                    id="game"
                    style={{ gridTemplateColumns: `repeat(${gSize}, auto)` }}
                >
                    {cells.map((cell, idx) => (
                        <CellWrap
                            key={`${gameKey}-${idx}`}
                            idx={idx}
                            cell={cell}
                            gameActive={gameActive}
                            onReveal={revealCell}
                        />
                    ))}
                </div>

                <div id="message">{message}</div>

                {/* Audio elements for win/lose sounds */}
                <audio ref={winSoundRef} src="/sounds/win.wav" preload="auto" />
                <audio ref={loseSoundRef} src="/sounds/lose.flac" preload="auto" />
            </div>
        </>
    )
}

// Cell component with scratch canvas - FIXED
interface CellWrapProps {
    idx: number
    cell: { emoji: string; revealed: boolean; isBomb: boolean }
    gameActive: boolean
    onReveal: (idx: number) => void
}

function CellWrap({ idx, cell, gameActive, onReveal }: CellWrapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isScratched, setIsScratched] = useState(false)
    const lastPos = useRef<{ x: number; y: number } | null>(null)
    const isDown = useRef(false)
    const hasInit = useRef(false)

    const size = typeof window !== 'undefined' && window.innerWidth < 400 ? 39 : 60

    // Initialize canvas on mount
    useEffect(() => {
        if (!hasInit.current && canvasRef.current) {
            drawBlackCover(canvasRef.current, size)
            hasInit.current = true
        }

        // Reset isDown when component mounts (new game)
        isDown.current = false
        lastPos.current = null

        return () => {
            // Cleanup on unmount
            isDown.current = false
            lastPos.current = null
        }
    }, [size])

    const drawBlackCover = (canvas: HTMLCanvasElement, size: number) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, size, size)
        ctx.save()
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI)
        ctx.clip()
        ctx.fillStyle = '#222'
        ctx.globalAlpha = 1
        ctx.fillRect(0, 0, size, size)
        ctx.restore()
    }

    const estimateScratched = (canvas: HTMLCanvasElement, size: number): number => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return 0

        let imgData
        try {
            imgData = ctx.getImageData(0, 0, size, size).data
        } catch {
            return 1
        }

        let total = 0
        let empty = 0
        const r2 = (size / 2) * (size / 2)

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - size / 2
                const dy = y - size / 2

                if (dx * dx + dy * dy < r2) {
                    total++
                    const i = (y * size + x) * 4
                    if (imgData[i + 3] < 80) {
                        empty++
                    }
                }
            }
        }

        return total > 0 ? empty / total : 0
    }

    const scratch = (e: React.MouseEvent | React.TouchEvent) => {
        // CRITICAL: Only scratch if mouse/touch is actually down
        if (!isDown.current) return
        if (!gameActive || isScratched) return

        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        let clientX: number, clientY: number

        if ('touches' in e && e.touches.length) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else if ('clientX' in e) {
            clientX = e.clientX
            clientY = e.clientY
        } else {
            return
        }

        const x = clientX - rect.left
        const y = clientY - rect.top
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(x, y, size / 7, 0, Math.PI * 2)
        ctx.fill()

        if (lastPos.current !== null) {
            ctx.beginPath()
            ctx.lineCap = 'round'
            ctx.lineWidth = size / 6.2
            ctx.moveTo(lastPos.current.x, lastPos.current.y)
            ctx.lineTo(x, y)
            ctx.stroke()
        }

        ctx.restore()
        lastPos.current = { x, y }

        if (estimateScratched(canvas, size) > 0.25) {
            setIsScratched(true)
            onReveal(idx)
        }
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!gameActive || isScratched) return
        e.preventDefault()
        isDown.current = true
        lastPos.current = null
        scratch(e)
    }

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!gameActive || isScratched) return
        e.preventDefault()
        isDown.current = true
        lastPos.current = null
        scratch(e)
    }

    const handleMouseUp = () => {
        isDown.current = false
        lastPos.current = null
    }

    const handleMouseLeave = () => {
        isDown.current = false
        lastPos.current = null
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        // Only scratch if mouse is actually pressed down
        if (!isDown.current || !gameActive || isScratched) return
        scratch(e)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDown.current || !gameActive || isScratched) return
        e.preventDefault()
        scratch(e)
    }

    // If already revealed or scratched, don't show canvas
    if (cell.revealed || isScratched) {
        return (
            <div className="cell-wrap">
                <div className={`cell revealed ${cell.isBomb ? 'bomb' : ''}`}>
                    {cell.isBomb ? '💣' : cell.emoji}
                </div>
            </div>
        )
    }

    return (
        <div className="cell-wrap">
            <div className="cell">
                {cell.emoji}
            </div>
            <canvas
                ref={canvasRef}
                className="cover-canvas"
                width={size}
                height={size}
                style={{ width: size, height: size }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleMouseUp}
                onTouchMove={handleTouchMove}
            />
        </div>
    )
}
