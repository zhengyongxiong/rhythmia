import type { HRVMetrics } from '../hrv/HRVCalculator'
import type { BeatPattern, TrainingGoal } from './types'

export function generateBeatPatternFromHRV(
    metrics: HRVMetrics,
    goal: TrainingGoal
): BeatPattern {
    const { rmssd } = metrics

    // Basic Rule Engine
    // RMSSD < 20ms: Stressed
    // RMSSD 20-50ms: Moderate
    // RMSSD > 50ms: Relaxed

    let baseBpm = 60
    let duration = 5
    let description = ''
    let bpmSchedule: { timeMinute: number; bpm: number }[] | undefined

    if (goal === 'relax') {
        // Goal: Lower HR, Increase HRV
        // If stressed (low RMSSD), start slightly higher and ramp down
        if (rmssd < 20) {
            baseBpm = 65
            bpmSchedule = [
                { timeMinute: 0, bpm: 65 },
                { timeMinute: 2, bpm: 60 },
                { timeMinute: 5, bpm: 55 }
            ]
            description = 'Detected high stress. Starting gently at 65 BPM and slowing down to 55 BPM to guide relaxation.'
        } else {
            baseBpm = 55
            description = 'Your HRV is good. Maintaining a slow, steady 55 BPM for deep relaxation.'
        }
        duration = 5
    } else if (goal === 'activate') {
        // Goal: Increase arousal
        baseBpm = 90
        description = ' upbeat tempo at 90 BPM to boost energy and focus.'
        duration = 3
    } else {
        // Balance (Coherence)
        // Often associated with resonance breathing ~6 breaths/min => ~0.1Hz, but for beat, we might just use HR.
        // 60 BPM is generally good for balance.
        baseBpm = 60
        description = 'Steady 60 BPM to promote heart coherence and balance.'
        duration = 5
    }

    return {
        baseBpm,
        durationMinutes: duration,
        accents: [1, 0, 0, 0], // 4/4
        bpmSchedule,
        description
    }
}
