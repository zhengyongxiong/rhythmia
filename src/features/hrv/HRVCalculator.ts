export interface HRVMetrics {
    rmssd: number // ms
    sdnn: number // ms
    pnn50: number // percentage (0-100)
    sampleCount: number
}

export class HRVCalculator {
    private rrIntervals: number[] = []
    private maxBeats: number
    private lastBeatTime: number | null = null

    constructor(maxBeats: number = 256) {
        this.maxBeats = maxBeats
    }

    addBeat(timestamp: number): void {
        if (this.lastBeatTime !== null) {
            const rr = timestamp - this.lastBeatTime
            this.addRRInterval(rr, timestamp)
        }
        this.lastBeatTime = timestamp
    }

    addRRInterval(rrMs: number, _timestamp: number): void {
        // Filter invalid RR (physiology range 300ms - 2000ms typically)
        if (rrMs < 300 || rrMs > 2000) return

        this.rrIntervals.push(rrMs)
        if (this.rrIntervals.length > this.maxBeats) {
            this.rrIntervals.shift()
        }
    }

    getMetrics(): HRVMetrics {
        if (this.rrIntervals.length < 2) {
            return { rmssd: 0, sdnn: 0, pnn50: 0, sampleCount: this.rrIntervals.length }
        }

        const rr = this.rrIntervals
        const n = rr.length

        // Calculate Mean RR
        const sum = rr.reduce((a, b) => a + b, 0)
        const mean = sum / n

        // Calculate SDNN (Standard Deviation of NN intervals)
        const squaredDiffs = rr.map(val => Math.pow(val - mean, 2))
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (n - 1)
        const sdnn = Math.sqrt(variance)

        // Calculate RMSSD and pNN50 (require differences)
        let sumSquaredDiffs = 0
        let nn50Count = 0

        for (let i = 1; i < n; i++) {
            const diff = rr[i] - rr[i - 1]
            sumSquaredDiffs += diff * diff
            if (Math.abs(diff) > 50) {
                nn50Count++
            }
        }

        const rmssd = Math.sqrt(sumSquaredDiffs / (n - 1))
        const pnn50 = (nn50Count / (n - 1)) * 100

        return {
            rmssd: Math.round(rmssd * 10) / 10,
            sdnn: Math.round(sdnn * 10) / 10,
            pnn50: Math.round(pnn50 * 10) / 10,
            sampleCount: n
        }
    }

    reset(): void {
        this.rrIntervals = []
        this.lastBeatTime = null
    }
}
