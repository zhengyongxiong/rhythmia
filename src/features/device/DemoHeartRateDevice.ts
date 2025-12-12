import type { HeartRateDevice, HeartRateSample, DeviceMode } from './types'

export class DemoHeartRateDevice implements HeartRateDevice {
    mode: DeviceMode = 'demo-simulated'
    isConnected: boolean = false
    name: string = 'Demo Device' // Ensure name is set

    private listeners: ((sample: HeartRateSample) => void)[] = []
    private intervalId: number | null = null
    private startTime: number = 0

    async connect(): Promise<void> {
        this.isConnected = true
        this.startTime = Date.now()
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 500))
        this.startSimulation()
    }

    async disconnect(): Promise<void> {
        this.stopSimulation()
        this.isConnected = false
    }

    onSample(callback: (sample: HeartRateSample) => void): void {
        this.listeners.push(callback)
    }

    offSample(callback: (sample: HeartRateSample) => void): void {
        this.listeners = this.listeners.filter(l => l !== callback)
    }

    private startSimulation() {
        if (this.intervalId) return

        this.intervalId = window.setInterval(() => {
            this.emitSimulatedSample()
        }, 1000)
    }

    private stopSimulation() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
    }

    private emitSimulatedSample() {
        const now = Date.now()
        const elapsedSec = (now - this.startTime) / 1000

        // Simulate BPM as a sine wave + noise
        // Base 70, amplitude 10, period 60s
        const baseBpm = 70 + 10 * Math.sin((elapsedSec * 2 * Math.PI) / 60)
        const noise = (Math.random() - 0.5) * 4
        const bpm = Math.round(baseBpm + noise)

        // Simulate RR interval
        // 60000 / bpm gives average RR in ms
        // Add variability (HRV)
        // Relaxed state -> higher variability (e.g. +/- 50ms)
        // Stressed state -> lower variability
        // We'll oscillate HRV too
        const hrvAmplitude = 30 + 20 * Math.sin((elapsedSec * 2 * Math.PI) / 120)
        const rrNoise = (Math.random() - 0.5) * hrvAmplitude * 2
        const rrMs = (60000 / bpm) + rrNoise

        const sample: HeartRateSample = {
            timestamp: now,
            bpm,
            rrMs
        }

        this.listeners.forEach(l => l(sample))
    }
}
