import { useState, useRef, useEffect } from 'react'
import { BeatPlayer } from './audioEngine'
import type { BeatPattern } from './types'

export function useBeatPlayer() {
    const playerRef = useRef<BeatPlayer | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    useEffect(() => {
        playerRef.current = new BeatPlayer()
        return () => {
            if (playerRef.current) {
                playerRef.current.stop()
            }
        }
    }, [])

    const start = async (pattern: BeatPattern) => {
        if (playerRef.current) {
            try {
                await playerRef.current.start(pattern)
                setIsPlaying(true)
            } catch (e) {
                console.error('Failed to start beat player', e)
            }
        }
    }

    const stop = () => {
        if (playerRef.current) {
            playerRef.current.stop()
            setIsPlaying(false)
        }
    }

    return { isPlaying, start, stop }
}
