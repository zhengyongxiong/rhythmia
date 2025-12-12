import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'
import { Activity, Heart, ArrowLeft, AlertTriangle } from 'lucide-react'
import { useDevice } from '../features/device/DeviceContext'
import { useLiveMetrics } from '../features/hrv/useLiveMetrics'
import { usePpgPlayback } from '../hooks/usePpgPlayback'
import { getVitalStatus, getStatusColorClass, type UserMode } from '../lib/vitalStatus'
import ppgData from "../data/Subject4F_PPG.json"

export default function LiveMonitorPage() {
    const { isConnected, device } = useDevice()
    const { bpm: bleBpm, hrv: bleHrv } = useLiveMetrics()

    const [userMode, setUserMode] = useState<UserMode>('resting')

    // New PPG Engine
    const {
        waveY,
        bpm: ppgBpm,
        sdnnText: ppgSdnn,
        rmssd: ppgRmssd,
        pnn50: ppgPnn50,
        setIsPlaying,
        debug
    } = usePpgPlayback((ppgData as { signal: number[] }).signal)

    // Auto-play on mount
    useEffect(() => {
        setIsPlaying(true)
        return () => setIsPlaying(false)
    }, [setIsPlaying])

    // Data Prep
    const displayBpm = ppgBpm || bleBpm;
    // Parse SDNN text "42 ms" -> 42. Handle "Collecting..." -> 0 (or pass null to helper)
    let rawSdnn = 0;
    if (ppgSdnn.includes('ms')) {
        rawSdnn = parseFloat(ppgSdnn);
    }
    // If "Collecting", rawSdnn stays 0 or we can treat as null?
    // Helper expects null to show muted.
    // Hook returns "Collecting 5/20".

    // Calculate Status
    const status = getVitalStatus({
        bpm: displayBpm,
        sdnn: rawSdnn > 0 ? rawSdnn : null,
        mode: userMode,
        nnCount: debug.nnCount // Use debug nnCount (rolling), or parse text? Text is safer for "Collecting" state match.
    });

    // Redirect
    if (!isConnected) {
        return <Navigate to="/" replace />
    }

    const chartData = useMemo(() => waveY.map((y, i) => ({ i, y })), [waveY])

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        <h1 className="text-lg font-bold text-gray-900">Live Monitor</h1>
                    </div>
                    {/* Mode Toggle */}
                    <button
                        onClick={() => setUserMode(m => m === 'resting' ? 'active' : 'resting')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${userMode === 'active'
                            ? 'bg-orange-500 text-white'
                            : 'bg-blue-100 text-blue-700'
                            }`}
                    >
                        {userMode} Mode
                    </button>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* Device Status & BPM */}
                <div className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transition-colors duration-500 ${status.bpmColor === 'danger' ? 'bg-red-600' :
                    status.bpmColor === 'warn' ? 'bg-yellow-500' :
                        status.bpmColor === 'muted' ? 'bg-gray-400' :
                            'bg-indigo-600'
                    }`}>
                    <div className="flex items-center justify-between mb-2 relative z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-white/80 text-sm font-medium uppercase tracking-wider">Heart Rate</span>
                            {/* Warnings */}
                            {status.bpmColor === 'danger' && (
                                <span className="bg-white/20 px-2 py-0.5 rounded textxs font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> {status.bpmLabel}
                                </span>
                            )}
                        </div>
                        <Heart className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div className="flex items-baseline gap-2 relative z-10">
                        <span className="text-6xl font-bold font-mono">{displayBpm ? displayBpm : '--'}</span>
                        <span className="text-xl opacity-80">BPM</span>
                    </div>
                    <div className="mt-2 text-white/60 text-sm relative z-10 flex justify-between">
                        <span>Source: {ppgBpm ? 'PPG Engine' : device?.name}</span>
                        <span>{userMode} thresholds</span>
                    </div>

                    {/* Background Pulse Effect */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl opacity-10 -mr-16 -mt-16 animate-pulse"></div>
                </div>

                {/* PPG Waveform Chart */}
                <div className="bg-black p-4 rounded-xl shadow-sm border border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold text-green-500 uppercase tracking-wider">Real-time PPG</h3>
                        <div className="text-xs text-gray-500 font-mono">
                            MAD: {debug.mad.toFixed(4)} | Valid: {debug.nnCount} | Rej: {debug.rejectedCount}
                        </div>
                    </div>
                    <div className="h-48 w-full" style={{ minHeight: '192px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <YAxis domain={['auto', 'auto']} hide />
                                <Line
                                    type="monotone"
                                    dataKey="y"
                                    stroke="#22c55e"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* HRV Grid */}
                <div className="grid grid-cols-3 gap-3">
                    <MetricCard
                        label="RMSSD"
                        value={ppgRmssd !== null ? ppgRmssd.toFixed(1) : (bleHrv.rmssd > 0 ? bleHrv.rmssd : '--')}
                        unit="ms"
                    />

                    {/* SDNN Card with Color */}
                    <div className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center relative group`}>
                        <div className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1 cursor-help" title="Standard Deviation of NN intervals">
                            SDNN
                        </div>
                        <div className={`text-2xl font-bold truncate w-full ${getStatusColorClass(status.sdnnColor)}`}>
                            {ppgSdnn.includes('Coll') ? '...' : (rawSdnn || '--')}
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">
                            {ppgSdnn.includes('Coll') ? ppgSdnn : (status.sdnnLabel !== 'Normal' ? status.sdnnLabel : 'ms')}
                        </div>
                    </div>

                    <MetricCard
                        label="pNN50"
                        value={ppgPnn50 !== null ? ppgPnn50.toFixed(0) : bleHrv.pnn50}
                        unit="%"
                    />
                </div>

                {/* Disclaimer */}
                <div className="text-center text-xs text-gray-400 mt-8 pb-4">
                    For reference only. Not medical advice.
                </div>

                {/* Legacy Charts (Hidden or Kept for now) */}
                {/* ... kept as is or minimized ... */}

            </main>
        </div>
    )
}

function MetricCard({ label, value, unit, tooltip, colorClass = "text-gray-800" }: { label: string, value: number | string, unit: string, tooltip?: string, colorClass?: string }) {
    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center relative group">
            <div className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1 cursor-help" title={tooltip}>
                {label}
            </div>
            <div className={`text-2xl font-bold truncate w-full ${colorClass}`}>
                {value}
            </div>
            <div className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">{unit}</div>
        </div>
    )
}
