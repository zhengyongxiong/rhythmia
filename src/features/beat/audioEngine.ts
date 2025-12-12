import type { BeatPattern } from './types'

export class BeatPlayer {
    private audioContext: AudioContext | null = null
    private nextNoteTime: number = 0.0
    private timerID: number | null = null
    private isPlaying: boolean = false
    private currentPattern: BeatPattern | null = null
    private beatCount: number = 0

    // Scheduler settings
    private lookahead: number = 25.0 // ms
    private scheduleAheadTime: number = 0.1 // s

    constructor() {
        // Lazy init
    }

    private initContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
    }

    async start(pattern: BeatPattern) {
        this.initContext()
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume()
        }

        this.currentPattern = pattern
        this.isPlaying = true
        this.beatCount = 0
        this.nextNoteTime = this.audioContext!.currentTime + 0.05
        this.scheduler()
    }

    stop() {
        this.isPlaying = false
        if (this.timerID) {
            window.clearTimeout(this.timerID)
            this.timerID = null
        }
    }

    getIsPlaying() {
        return this.isPlaying
    }

    private nextNote() {
        const secondsPerBeat = 60.0 / this.getCurrentBpm()
        this.nextNoteTime += secondsPerBeat
        this.beatCount++
    }

    private getCurrentBpm(): number {
        if (!this.currentPattern) return 60

        // Check schedule
        // For simplicity, just return baseBpm or interpolate if we had a start time.
        // Implementing complex schedule requires tracking elapsed time.
        // For this MVP, use baseBpm or if schedule exists, simple logic.

        // TODO: Implement schedule interpolation
        return this.currentPattern.baseBpm
    }

    private scheduleNote(beatNumber: number, time: number) {
        if (!this.audioContext || !this.currentPattern) return

        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()

        osc.connect(gain)
        gain.connect(this.audioContext.destination)

        // Accent logic: first beat of bar
        // accents: [1, 0, 0, 0]
        const beatsPerBar = this.currentPattern.accents.length
        const index = beatNumber % beatsPerBar
        const isAccent = this.currentPattern.accents[index] === 1

        if (isAccent) {
            osc.frequency.value = 880
        } else {
            osc.frequency.value = 440
        }

        gain.gain.setValueAtTime(isAccent ? 1 : 0.5, time) // Envelope start
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)

        osc.start(time)
        osc.stop(time + 0.1)
    }

    private scheduler = () => {
        if (!this.isPlaying || !this.audioContext) return

        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.beatCount, this.nextNoteTime)
            this.nextNote()
        }

        this.timerID = window.setTimeout(this.scheduler, this.lookahead)
    }
}
