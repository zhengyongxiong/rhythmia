/**
 * src/hooks/usePpgPlayback.ts
 * React hook to manage:
 * 1. Playback loop (requestAnimationFrame)
 * 2. Real-time Window extraction
 * 3. Signal Processing calls (Filter -> Norm -> Peak)
 * 4. Analytics State (Accumulating SDNN)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    PPG_CONFIG,
    applyBandpass,
    robustNormalize,
    detectPeaks,
    computeMetrics,
    calcSdnnFromHistory,
    calcRmssd,
    calcPnn50,
    isValidIBI,

} from '../lib/ppgMetrics';

export interface DebugStats {
    window: number;
    peaksInView: number;
    nnCount: number;
    mad: number;
    rejectedCount: number;
    lastIBI: number;
    renderMs: number;
}

export function usePpgPlayback(
    fullSignal: number[],  // The entire loaded signal (raw)
    config = PPG_CONFIG
) {
    // --- STATE ---
    const [waveY, setWaveY] = useState<number[]>([]);
    const [bpm, setBpm] = useState<number | null>(null);
    const [sdnn, setSdnn] = useState<number | null>(null);
    const [sdnnText, setSdnnText] = useState<string>('--');
    const [debug, setDebug] = useState<DebugStats>({
        window: config.windowSeconds,
        peaksInView: 0,
        nnCount: 0,
        mad: 0,
        rejectedCount: 0,
        lastIBI: 0,
        renderMs: 0
    });

    // Playback
    const [isPlaying, setIsPlaying] = useState(false);

    // Refs
    const indexRef = useRef(0); // Floating point index
    const lastTimeRef = useRef(0);
    const reqRef = useRef<number>(0);

    // Data Buffer
    const [filteredSignal, setFilteredSignal] = useState<number[]>([]);

    // Analytics State
    const nnHistoryRef = useRef<number[]>([]); // Rolling buffer
    const lastMetricsUpdateRef = useRef(0);
    const lastGuiUpdateRef = useRef(0);
    const lastAbsPeakRef = useRef(-1); // Absolute index of last processed peak
    const rejectedCountRef = useRef(0);
    const lastBpmRef = useRef<number | null>(null);

    // --- 1. PRE-PROCESS ---
    useEffect(() => {
        if (fullSignal.length === 0) return;

        // 1. Invert Signal (Standard PPG: More blood = More Absorption = Less Reflected Light)
        // We want Positive Peaks for Systole.
        const inverted = fullSignal.map(x => -x);

        // 2. Filter valid signal
        const filtered = applyBandpass(inverted, config.fs, config.fcLow, config.fcHigh);
        setFilteredSignal(filtered);

        // Reset State
        indexRef.current = 0;
        nnHistoryRef.current = [];
        lastAbsPeakRef.current = -1;
        rejectedCountRef.current = 0;
        setBpm(null);
        setSdnn(null);
        setSdnnText('Initializing...');

    }, [fullSignal, config]);

    // --- 2. LOOP ---
    const loop = useCallback((time: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const dt = time - lastTimeRef.current;
        lastTimeRef.current = time;

        if (filteredSignal.length === 0) {
            reqRef.current = requestAnimationFrame(loop);
            return;
        }

        const t0 = performance.now();

        // A. Advance
        if (isPlaying) {
            const samplesToAdvance = (dt / 1000) * config.fs;
            indexRef.current += samplesToAdvance;

            // Loop Logic
            if (indexRef.current >= filteredSignal.length) {
                indexRef.current = 0;
                // Reset State on Loop to prevent discontinuities and "Stuck" logic
                nnHistoryRef.current = [];
                lastAbsPeakRef.current = -1;
                // Optional: clear lastBpm to re-smooth? Maybe not, better to drift.
            }
        }

        // B. Window
        const currIdx = Math.floor(indexRef.current);
        const winLen = config.windowSeconds * config.fs;
        const startIdx = currIdx - winLen;

        // Handle Edge Cases (Start < 0) - Pad with 0
        let slice: number[];
        let sliceStartAbs = startIdx; // Absolute index of the start of the slice

        if (startIdx < 0) {
            const padding = new Array(Math.abs(startIdx)).fill(0);
            slice = [...padding, ...filteredSignal.slice(0, currIdx)];
        } else {
            slice = filteredSignal.slice(startIdx, currIdx);
        }

        // C. Normalize (Visualization)
        let mad = 0; // Initialize mad here to be accessible later
        // Throttle GUI updates to ~10fps (100ms) to prevent React/Recharts overload and OOM
        // For large datasets (millions of samples), limit display array size
        if (time - lastGuiUpdateRef.current > 100) {
            lastGuiUpdateRef.current = time;
            const { data: normData, mad: currentMad } = robustNormalize(slice);

            // Downsample if needed: Keep max 1500 points for display
            const MAX_DISPLAY_POINTS = 1500;
            let displayData = normData;
            if (normData.length > MAX_DISPLAY_POINTS) {
                const step = Math.ceil(normData.length / MAX_DISPLAY_POINTS);
                displayData = normData.filter((_: number, idx: number) => idx % step === 0);
            }

            setWaveY(displayData);
            mad = currentMad; // Update mad for this frame

            // D. Analytics (Throttled independantly, usually slower e.g. 500ms)
            // But we can just use the same throttle or keep them separate?
            // Let's keep separate to ensure logic runs at config speed
        }

        // However, calculating MAD/Peaks EVERY frame is wasteful if we don't render.
        // Let's optimize:

        // D. Analytics Check
        if (time - lastMetricsUpdateRef.current > config.hrvUpdateMs) {
            // ... existing analytics logic ...
            // We need 'slice' here.
            // If we didn't calculate normData above, we might miss 'mad' for debug?
            // It's fine, debug update is inside this block.

            // Re-calculate robustNormalize just for stats? 
            // Or optimize to do it only once?
            // Let's just do it here if needed.
            // robustNormalize is fast.

            // If mad wasn't updated in the GUI throttle block, calculate it now for analytics
            if (mad === 0) { // Assuming mad will be > 0 for valid signals
                const { mad: currentMad } = robustNormalize(slice);
                mad = currentMad;
            }

            lastMetricsUpdateRef.current = time;

            // Recalculate stats for analytics/debug (every 500ms)
            // 1. Detect Peaks in current window
            const { validIndices } = detectPeaks(slice, config.fs, config);

            // 2. Metrics (Instantaneous BPM)
            const metrics = computeMetrics(validIndices, config.fs, config);

            // BPM Processing (Smoothing + Freezing)
            if (metrics.bpm && metrics.bpm >= 40) { // Constraint: < 40 is invalid/freeze
                // If we had a previous BPM, apply EMA
                if (lastBpmRef.current) {
                    const alpha = 0.15; // Smooth
                    const smoothed = lastBpmRef.current * (1 - alpha) + metrics.bpm * alpha;
                    lastBpmRef.current = smoothed;
                    setBpm(Math.round(smoothed));
                } else {
                    // First valid reading
                    lastBpmRef.current = metrics.bpm;
                    setBpm(Math.round(metrics.bpm));
                }
            } else {
                // If BPM < 40 or null (noise), do NOT update state (Freeze)
                // BUT only if we have a previous value. If never valid, stay null.
                if (!lastBpmRef.current) {
                    setBpm(null); // Analyzing...
                }
                // If we have value, we keep it (Freeze) to avoid 0 spikes.
            }

            // 3. Process Peaks for Ring Buffer
            // Convert found peaks to absolute indices
            // Note: If we padded, slice index 0 corresponds to absolute index startIdx (which was negative).
            // So abs = startIdx + rel.
            const absPeaks = validIndices.map((i: number) => Math.floor(sliceStartAbs + i));

            // Identify NEW peaks
            const newPeaks = absPeaks.filter((p: number) => p > lastAbsPeakRef.current);
            let lastNewIBI = 0;

            if (newPeaks.length > 0) {
                let prevPeak = lastAbsPeakRef.current;

                // If first run, settle baseline
                if (prevPeak === -1) {
                    lastAbsPeakRef.current = newPeaks[newPeaks.length - 1];
                    // Can we salvage internal IBIs?
                    for (let i = 1; i < newPeaks.length; i++) {
                        const dist = newPeaks[i] - newPeaks[i - 1];
                        const ms = (dist / config.fs) * 1000;
                        // Validate Internal
                        if (isValidIBI(ms, null, config)) {
                            nnHistoryRef.current.push(ms);
                        }
                    }
                } else {
                    // Have valid history
                    // Median for outlier detection
                    const sortedHist = [...nnHistoryRef.current].sort((a, b) => a - b);
                    const median = sortedHist.length > 0 ? sortedHist[Math.floor(sortedHist.length / 2)] : null;

                    for (const p of newPeaks) {
                        const dist = p - prevPeak;
                        const ms = (dist / config.fs) * 1000;

                        // Strict Validation
                        if (isValidIBI(ms, median, config)) {
                            nnHistoryRef.current.push(ms);
                            lastNewIBI = ms;
                        } else {
                            rejectedCountRef.current += 1;
                        }
                        prevPeak = p;
                    }
                    lastAbsPeakRef.current = prevPeak;
                }

                // Rolling Window: Keep last 30
                if (nnHistoryRef.current.length > 30) {
                    nnHistoryRef.current = nnHistoryRef.current.slice(-30);
                }
            }

            // 4. Calculate HRV Metrics
            const nnCount = nnHistoryRef.current.length;

            // SDNN
            const sdnnVal = calcSdnnFromHistory(nnHistoryRef.current); // requires 30
            if (sdnnVal !== null) {
                setSdnn(sdnnVal);
                setSdnnText(`${sdnnVal.toFixed(0)} ms`);
            } else {
                setSdnnText(`Collecting ${nnCount}/30`);
            }

            // Optional: You could expose RMSSD here too if you want to use PPG RMSSD instead of BLE
            // const rmssd = calcRmssd(nnHistoryRef.current);
            // const pnn50 = calcPnn50(nnHistoryRef.current);
            // setRmssd(rmssd); ...

            // Update Debug
            setDebug({
                window: config.windowSeconds,
                peaksInView: validIndices.length,
                nnCount,
                mad: mad > 0 ? mad : 0,
                rejectedCount: rejectedCountRef.current,
                lastIBI: lastNewIBI,
                renderMs: performance.now() - t0
            });
        }

        reqRef.current = requestAnimationFrame(loop);

    }, [isPlaying, filteredSignal, config]);


    // --- 3. LIFECYCLE ---
    useEffect(() => {
        reqRef.current = requestAnimationFrame(loop);
        return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
    }, [loop]);

    return {
        waveY,
        bpm,
        sdnn,
        sdnnText,
        rmssd: sdnnText.includes('Col') ? null : (calcRmssd(nnHistoryRef.current) || 0),
        pnn50: sdnnText.includes('Col') ? null : (calcPnn50(nnHistoryRef.current) || 0),
        debug,
        setIsPlaying
    };
}

