import { Link, Navigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Activity, Heart, ArrowLeft } from 'lucide-react'
import { useDevice } from '../features/device/DeviceContext'
import { useLiveMetrics } from '../features/hrv/useLiveMetrics'

export default function LiveMonitorPage() {
    const { isConnected, device } = useDevice()
    const { bpm, hrv, history } = useLiveMetrics()

    // Redirect if not connected
    if (!isConnected) {
        return <Navigate to="/" replace />
    }

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
                    <div className="w-6"></div> {/* Spacer */}
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* Device Status */}
                <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-indigo-200 text-sm font-medium uppercase tracking-wider">Heart Rate</span>
                        <Heart className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-6xl font-bold font-mono">{bpm > 0 ? bpm : '--'}</span>
                        <span className="text-xl opacity-80">BPM</span>
                    </div>
                    <div className="mt-2 text-indigo-200 text-sm">
                        Connected to: {device?.name}
                    </div>
                </div>

                {/* HRV Grid */}
                <div className="grid grid-cols-3 gap-3">
                    <MetricCard label="RMSSD" value={hrv.rmssd} unit="ms" tooltip="Root Mean Square of Successive Differences. A key marker of Parasympathetic activity (relaxation)." />
                    <MetricCard label="SDNN" value={hrv.sdnn} unit="ms" tooltip="Standard Deviation of NN intervals. Reflects overall autonomic health." />
                    <MetricCard label="pNN50" value={hrv.pnn50} unit="%" tooltip="Percentage of successive RR intervals that differ by more than 50ms." />
                </div>

                {/* Charts */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Heart Rate Trend</h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="time" hide />
                                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ display: 'none' }}
                                />
                                <Line type="monotone" dataKey="bpm" stroke="#4f46e5" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Stress Index (RMSSD)</h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="time" hide />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ display: 'none' }}
                                />
                                <Line type="monotone" dataKey="rmssd" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </main>
        </div>
    )
}

function MetricCard({ label, value, unit }: { label: string, value: number, unit: string, tooltip?: string }) {
    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center relative group">
            <div className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1 cursor-help">
                {label}
                {/* Simple tooltip simulation */}
            </div>
            <div className="text-2xl font-bold text-gray-800">
                {value}
            </div>
            <div className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">{unit}</div>
        </div>
    )
}
