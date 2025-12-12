export type DeviceMode = 'ble-real' | 'demo-simulated'

export interface HeartRateSample {
    timestamp: number   // ms
    bpm: number         // Current heart rate
    rrMs?: number       // RR interval in ms, if available
}

export interface HeartRateDevice {
    mode: DeviceMode
    isConnected: boolean
    name: string
    connect(): Promise<void>
    disconnect(): Promise<void>
    onSample(callback: (sample: HeartRateSample) => void): void
    offSample(callback: (sample: HeartRateSample) => void): void
}
