/**
 * src/lib/ppgMetrics.ts
 * Pure signal processing logic for PPG.
 * 
 * 1. Bandpass Filter (Cascaded Biquads)
 * 2. Robust Normalization (Median/MAD)
 * 3. Peak Detection (Adaptive Threshold)
 * 4. Metrics Calculation (HR, SDNN)
 */

// --- 1. CONFIG ---
export const PPG_CONFIG = {
    fs: 50,
    windowSeconds: 8,
    // Filter
    fcLow: 0.7,
    fcHigh: 4.0,
    // Peaks
    peakMinDistanceSec: 0.35,  // ~170 BPM max
    peakThresholdK: 0.6,       // Height > Median + 0.6*MAD
    // Metrics
    nnTarget: 30,              // Need 30 valid beats for confident SDNN
    hrvUpdateMs: 500,          // Update stats every 500ms
    // Validation
    ibiMinMs: 300,
    ibiMaxMs: 2000,
};

// --- 2. FILTERING (Pure Functions) ---

// Stateless Biquad Filter (Direct Form I)
// y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
function biquadFilter(input: number[], b: number[], a: number[]): number[] {
    const output = new Float32Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    // Normalize coefficients by a0 if not already done, usually a[0] is 1 after normalization
    // Here we assume coefficients are pre-normalized so a0=1.

    for (let i = 0; i < input.length; i++) {
        const x = input[i];
        const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;

        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;

        output[i] = y;
    }
    return Array.from(output);
}

// Generate coefficients for a 2nd order Butterworth section
function getBiquadCoeffs(type: 'hp' | 'lp', fs: number, fc: number, Q = 0.707) {
    const w0 = 2 * Math.PI * fc / fs;
    const alpha = Math.sin(w0) / (2 * Q);
    const cosw = Math.cos(w0);

    let b0 = 0, b1 = 0, b2 = 0, a0 = 0, a1 = 0, a2 = 0;

    if (type === 'hp') {
        b0 = (1 + cosw) / 2;
        b1 = -(1 + cosw);
        b2 = (1 + cosw) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw;
        a2 = 1 - alpha;
    } else {
        b0 = (1 - cosw) / 2;
        b1 = 1 - cosw;
        b2 = (1 - cosw) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw;
        a2 = 1 - alpha;
    }

    return {
        b: [b0 / a0, b1 / a0, b2 / a0],
        a: [a1 / a0, a2 / a0] // We normally use a1, a2 for the difference equation (y terms)
    };
}

export function applyBandpass(samples: number[], fs: number, fcLow: number, fcHigh: number): number[] {
    if (samples.length === 0) return [];

    // 1. Highpass (0.7Hz) - Remove baseline drift/respiration
    const hp = getBiquadCoeffs('hp', fs, fcLow);
    const stage1 = biquadFilter(samples, hp.b, hp.a);

    // 2. Lowpass (4.0Hz) - Remove HFS noise/mains
    const lp = getBiquadCoeffs('lp', fs, fcHigh);
    const stage2 = biquadFilter(stage1, lp.b, lp.a);

    return stage2;
}


// --- 3. NORMALIZATION & PEAKS ---

export function robustNormalize(samples: number[]): { data: number[], mad: number, median: number } {
    if (samples.length === 0) return { data: [], mad: 0, median: 0 };

    // 1. Median
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // 2. MAD (Median Absolute Deviation)
    const diffs = samples.map(s => Math.abs(s - median)).sort((a, b) => a - b);
    const rawMad = diffs[Math.floor(diffs.length / 2)];

    // 3. Scale to Sigma
    // 1.4826 * MAD matches StdDev for normal distribution
    const mad = rawMad * 1.4826;
    const scale = mad || 1; // Prevent div/0

    // 4. Transform: y = (x - Median) / Scale
    const data = samples.map(s => (s - median) / scale);

    return { data, mad, median };
}

export function detectPeaks(samples: number[], fs: number, cfg = PPG_CONFIG): { indices: number[], validIndices: number[] } {
    if (samples.length < 2) return { indices: [], validIndices: [] };

    // 1. Get Robust Stats for Threshold
    // Requirement: Threshold = Median + k * MAD (Raw MAD, not Sigma)

    // We can use robustNormalize to get the stats, but we need to be careful with what 'mad' returns.
    // robustNormalize returns 'mad' as the SCALED MAD (Sigma).
    // We need the RAW MAD.
    // Sigma = RawMAD * 1.4826  =>  RawMAD = Sigma / 1.4826

    const { data: normData } = robustNormalize(samples);

    // Threshold in RAW domain


    // Threshold in NORMALIZED domain
    // y = (x - Median) / Sigma
    // ThreshNorm = (RawThreshold - Median) / Sigma
    //            = (Median + k*RawMad - Median) / Sigma
    //            = (k * RawMad) / (RawMad * 1.4826)
    //            = k / 1.4826

    const k = cfg.peakThresholdK; // 0.6
    const normThreshold = k / 1.4826;

    const indices: number[] = [];
    const minDistSamples = Math.floor(cfg.peakMinDistanceSec * fs);

    // 2. Identify Local Maxima > Threshold (using Normalized data for convenience, equivalent to Raw)
    for (let i = 1; i < normData.length - 1; i++) {
        const y = normData[i];
        if (y > normThreshold && y > normData[i - 1] && y >= normData[i + 1]) {
            indices.push(i);
        }
    }

    // 3. Greedy De-duplication (Keep highest)
    const valid: number[] = [];
    if (indices.length > 0) {
        let lastParams = { idx: indices[0], val: normData[indices[0]] };

        for (let i = 1; i < indices.length; i++) {
            const currIdx = indices[i];
            const currVal = normData[indices[i]];

            if (currIdx - lastParams.idx < minDistSamples) {
                // Conflict
                if (currVal > lastParams.val) {
                    lastParams = { idx: currIdx, val: currVal };
                }
            } else {
                // Commit
                valid.push(lastParams.idx);
                lastParams = { idx: currIdx, val: currVal };
            }
        }
        valid.push(lastParams.idx);
    }

    return { indices, validIndices: valid };
}

// --- 4. METRICS & VALIDATION ---

export interface MetricResult {
    bpm: number | null;
    sdnn: number | null;
    nnCount: number;
    text: string;
}

export function computeMetrics(
    peakIndices: number[], // indices into the window
    fs: number,
    config = PPG_CONFIG
): MetricResult {
    if (peakIndices.length < 2) {
        return { bpm: null, sdnn: null, nnCount: 0, text: 'No Signal' };
    }

    // 1. Calculate IBIs (ms) for this window
    const ibiMs: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
        const diffSteps = peakIndices[i] - peakIndices[i - 1];
        const ms = (diffSteps / fs) * 1000;
        ibiMs.push(ms);
    }

    // 2. Filter IBIs (Physio Range only for instantaneous BPM)
    // For BPM we can be slightly looser or just use the strictly valid ones.
    const validIbi = ibiMs.filter(ms => ms >= config.ibiMinMs && ms <= config.ibiMaxMs);

    if (validIbi.length === 0) {
        return { bpm: null, sdnn: null, nnCount: 0, text: 'Noise' };
    }

    // 3. Instantaneous BPM = Median IBI of current window
    const sorted = [...validIbi].sort((a, b) => a - b);
    const medIBI = sorted[Math.floor(sorted.length / 2)];
    const bpm = 60000 / medIBI;

    return {
        bpm,
        sdnn: null,
        nnCount: validIbi.length,
        text: 'Live'
    };
}

/**
 * Validates a single IBI against physiological limits and statistical outliers.
 */
export function isValidIBI(
    ibi: number,
    historyMedian: number | null = null,
    config = PPG_CONFIG
): boolean {
    // 1. Hard Limits
    if (ibi < config.ibiMinMs || ibi > config.ibiMaxMs) return false;

    // 2. Statistical Outlier (if we have a baseline)
    // e.g., deviate > 30% from median
    if (historyMedian !== null && historyMedian > 0) {
        const deviation = Math.abs(ibi - historyMedian);
        const pct = deviation / historyMedian;
        if (pct > 0.3) return false; // Reject if > 30% jump
    }

    return true;
}

// Helper: Compute SDNN
export function calcSdnnFromHistory(nnMsHistory: number[]): number | null {
    if (nnMsHistory.length < 30) return null; // Stricter: 30

    const mean = nnMsHistory.reduce((a, b) => a + b, 0) / nnMsHistory.length;
    const variance = nnMsHistory.reduce((a, b) => a + (b - mean) ** 2, 0) / (nnMsHistory.length - 1);

    return Math.sqrt(variance);
}

// Helper: Compute RMSSD
export function calcRmssd(nnMsHistory: number[]): number | null {
    if (nnMsHistory.length < 20) return null; // Min 20

    let sumSqDiff = 0;
    for (let i = 1; i < nnMsHistory.length; i++) {
        const diff = nnMsHistory[i] - nnMsHistory[i - 1];
        sumSqDiff += diff * diff;
    }
    const meanSqDiff = sumSqDiff / (nnMsHistory.length - 1);
    return Math.sqrt(meanSqDiff);
}

// Helper: Compute pNN50
export function calcPnn50(nnMsHistory: number[]): number | null {
    if (nnMsHistory.length < 20) return null;

    let count50 = 0;
    for (let i = 1; i < nnMsHistory.length; i++) {
        const diff = Math.abs(nnMsHistory[i] - nnMsHistory[i - 1]);
        if (diff > 50) count50++;
    }
    return (count50 / (nnMsHistory.length - 1)) * 100;
}
