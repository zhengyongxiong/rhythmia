import { useState, useEffect, useRef } from 'react'
import { useDevice } from '../device/DeviceContext'
import { HRVCalculator, type HRVMetrics } from './HRVCalculator'

export interface LiveMetrics {
    bpm: number
    hrv: HRVMetrics
    history: { time: number; bpm: number; rmssd: number }[]
}

const MAX_HISTORY_POINTS = 300 // Keep last 5 mins assuming 1 sec updates

export function useLiveMetrics() {
    const { device } = useDevice()
    const calculatorRef = useRef<HRVCalculator>(new HRVCalculator())
    const [metrics, setMetrics] = useState<LiveMetrics>({
        bpm: 0,
        hrv: { rmssd: 0, sdnn: 0, pnn50: 0, sampleCount: 0 },
        history: []
    })

    // Use ref for mutable history to avoid stale closures in effects if we don't include it in deps
    // But strictly, we update state.

    useEffect(() => {
        if (!device) return

        const handleSample = (sample: { bpm: number; timestamp: number; rrMs?: number }) => {
            // Update Calculator
            if (sample.rrMs) {
                calculatorRef.current.addRRInterval(sample.rrMs, sample.timestamp)
            } else {
                calculatorRef.current.addBeat(sample.timestamp)
            }

            const hrv = calculatorRef.current.getMetrics()

            setMetrics(prev => {
                const newPoint = {
                    time: sample.timestamp,
                    bpm: sample.bpm,
                    rmssd: hrv.rmssd
                }

                const newHistory = [...prev.history, newPoint]
                if (newHistory.length > MAX_HISTORY_POINTS) {
                    newHistory.shift()
                }

                return {
                    bpm: sample.bpm,
                    hrv,
                    history: newHistory
                }
            })
        }

        device.onSample(handleSample)

        return () => {
            device.offSample(handleSample)
        }
    }, [device])

    const reset = () => {
        calculatorRef.current.reset()
        setMetrics({
            bpm: 0,
            hrv: { rmssd: 0, sdnn: 0, pnn50: 0, sampleCount: 0 },
            history: []
        })
    }

    return { ...metrics, reset }
}
