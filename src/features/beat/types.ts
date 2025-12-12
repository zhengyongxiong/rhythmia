export type TrainingGoal = 'relax' | 'activate' | 'balance'

export interface BeatPattern {
    baseBpm: number
    durationMinutes: number
    accents: number[]   // e.g. [1, 0, 0, 0] for 4/4 time with first beat accented
    bpmSchedule?: { timeMinute: number; bpm: number }[] // Ramp up/down
    description: string
}
