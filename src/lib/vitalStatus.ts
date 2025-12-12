/**
 * src/lib/vitalStatus.ts
 * Logic for grading Vital Signs (BPM, HRV) based on Context (Resting vs Active).
 */

export type VitalColor = 'ok' | 'warn' | 'danger' | 'muted';

export interface VitalStatus {
    bpmColor: VitalColor;
    bpmLabel: string;
    sdnnColor: VitalColor;
    sdnnLabel: string;
    warnings: string[];
}

export type UserMode = 'resting' | 'active';

export interface Thresholds {
    bpm: {
        low: number;   // Below this is Low (Red)
        high: number;  // Above this is High (Red)
    };
    sdnn: {
        danger: number; // < 20
        warn: number;   // < 50
        ok: number;     // 50 - 100
        high: number;   // 100 - 200 (OK)
        invalid: number;// > 200
    };
}

export const VITAL_THRESHOLDS: Record<UserMode, Thresholds> = {
    resting: {
        bpm: { low: 50, high: 90 }, // Updated: 50-90 Normal
        sdnn: { danger: 20, warn: 50, ok: 100, high: 200, invalid: 500 } // invalid > 500
    },
    active: {
        bpm: { low: 60, high: 160 },
        sdnn: { danger: 20, warn: 50, ok: 100, high: 200, invalid: 500 }
    }
};

export function getVitalStatus({
    bpm,
    sdnn,
    mode = 'resting',
    nnCount = 0
}: {
    bpm: number | null;
    sdnn: number | null;
    mode: UserMode;
    nnCount: number;
}): VitalStatus {
    const res: VitalStatus = {
        bpmColor: 'muted',
        bpmLabel: '--',
        sdnnColor: 'muted',
        sdnnLabel: '--',
        warnings: []
    };

    const cfg = VITAL_THRESHOLDS[mode];

    // --- BPM ---
    if (bpm === null || isNaN(bpm) || bpm === 0) {
        res.bpmColor = 'muted';
        res.bpmLabel = 'Analyzing...';
    } else if (bpm > 240 || bpm < 30) {
        // Freeze/Reject logic usually happens in Hook, but if it gets here:
        res.bpmColor = 'muted';
        res.warnings.push('signal_invalid');
        res.bpmLabel = 'Inv';
    } else {
        if (bpm < cfg.bpm.low) {
            res.bpmColor = 'warn'; // < 50 is warn/low (User said red/danger actually)
            // Re-read: "< 50 bpm (红色)" -> Danger
            res.bpmColor = 'danger';
            res.bpmLabel = 'Low';
        } else if (bpm > cfg.bpm.high) { // > 90
            res.bpmColor = 'danger'; // User said > 100 red. 90-100?
            // User req: "Normal 50-90". So > 90 is warn/danger?
            // "过高：> 100 bpm（红色）"
            // So 90-100 is... probably Warn?
            // Let's stick to simple: Outside normal = Warn/Danger.
            // Let's use Warn for 90-100, Danger > 100.
            if (bpm > 100) res.bpmColor = 'danger';
            else res.bpmColor = 'warn';
            res.bpmLabel = 'High';
        } else {
            res.bpmColor = 'ok';
            res.bpmLabel = 'Normal';
        }
    }

    // --- SDNN ---
    if (nnCount < 30 || sdnn === null) {
        res.sdnnColor = 'muted';
        res.sdnnLabel = 'Collecting...';
    } else if (sdnn < 0 || sdnn > 500) {
        res.sdnnColor = 'muted';
        res.warnings.push('hrv_invalid');
        res.sdnnLabel = 'Inv';
    } else {
        if (sdnn >= cfg.sdnn.ok) { // > 100
            // High HRV is usually good (Athletic)
            // > 200 might be artifact, but user said "High HRV (>150–200 ms) should NOT be treated as error"
            res.sdnnColor = 'ok';
            res.sdnnLabel = 'High (Good)';
        } else if (sdnn >= cfg.sdnn.warn) { // 50 - 100
            res.sdnnColor = 'ok';
            res.sdnnLabel = 'Normal';
        } else if (sdnn >= cfg.sdnn.danger) { // 20 - 50
            res.sdnnColor = 'warn';
            res.sdnnLabel = 'Low';
        } else { // < 20
            res.sdnnColor = 'danger';
            res.sdnnLabel = 'Very Low';
        }
    }

    return res;
}

// Helper for UI class mapping
export function getStatusColorClass(color: VitalColor): string {
    switch (color) {
        case 'ok': return 'text-green-500';
        case 'warn': return 'text-yellow-500';
        case 'danger': return 'text-red-500';
        case 'muted': return 'text-gray-400';
    }
}
