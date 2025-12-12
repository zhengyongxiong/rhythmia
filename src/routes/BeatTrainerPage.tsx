import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Brain, Square, Play, Bluetooth, BluetoothConnected, AlertCircle } from 'lucide-react'
import { useDevice } from '../features/device/DeviceContext'
import { useLiveMetrics } from '../features/hrv/useLiveMetrics'
import { generateBeatPatternFromHRV } from '../features/beat/beatGenerator'
import { useBeatPlayer } from '../features/beat/useBeatPlayer'
import { type BeatPattern, type TrainingGoal } from '../features/beat/types'

export default function BeatTrainerPage() {
    const { isConnected } = useDevice()
    const { hrv } = useLiveMetrics()
    const {
        isPlaying,
        start,
        stop,
        bluetoothState,
        bluetoothDeviceName,
        connectBluetooth,
        disconnectBluetooth,
        isBluetoothSupported
    } = useBeatPlayer()

    const [goal, setGoal] = useState<TrainingGoal>('relax')
    const [pattern, setPattern] = useState<BeatPattern | null>(null)
    const [bluetoothError, setBluetoothError] = useState<string | null>(null)

    // Redirect if not connected
    if (!isConnected) {
        return <Navigate to="/" replace />
    }

    const handleGenerate = () => {
        const newPattern = generateBeatPatternFromHRV(hrv, goal)
        setPattern(newPattern)
        // If playing, stop
        if (isPlaying) stop()
    }

    const togglePlay = () => {
        if (isPlaying) {
            stop()
        } else if (pattern) {
            start(pattern)
        }
    }

    const handleBluetoothConnect = async () => {
        setBluetoothError(null)
        try {
            await connectBluetooth()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to connect to Bluetooth device'
            setBluetoothError(message)
            console.error('Bluetooth connection error:', error)
        }
    }

    const handleBluetoothDisconnect = async () => {
        try {
            await disconnectBluetooth()
            setBluetoothError(null)
        } catch (error) {
            console.error('Bluetooth disconnection error:', error)
        }
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
                        <Brain className="w-5 h-5 text-purple-600" />
                        <h1 className="text-lg font-bold text-gray-900">AI Beat Trainer</h1>
                    </div>
                    <div className="w-6"></div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                {/* HRV Summary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase">Current HRV State</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-800">{hrv.rmssd}</span>
                        <span className="text-sm text-gray-500">ms (RMSSD)</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                        {hrv.rmssd < 20 ? 'High arousal/stress detected' : hrv.rmssd > 50 ? 'Relaxed state detected' : 'Moderate state'}
                    </p>
                </div>

                {/* Bluetooth Connection */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {bluetoothState === 'connected' ? (
                                <BluetoothConnected className="w-5 h-5 text-blue-600" />
                            ) : (
                                <Bluetooth className="w-5 h-5 text-gray-400" />
                            )}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700">
                                    {bluetoothState === 'connected' ? 'Drum Connected' : 'Connect Drum Device'}
                                </h3>
                                {bluetoothDeviceName && (
                                    <p className="text-xs text-gray-500">{bluetoothDeviceName}</p>
                                )}
                            </div>
                        </div>

                        {isBluetoothSupported ? (
                            <button
                                onClick={bluetoothState === 'connected' ? handleBluetoothDisconnect : handleBluetoothConnect}
                                disabled={bluetoothState === 'connecting'}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bluetoothState === 'connected'
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                        : bluetoothState === 'connecting'
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                            >
                                {bluetoothState === 'connecting' ? 'Connecting...' : bluetoothState === 'connected' ? 'Disconnect' : 'Connect'}
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-amber-600">
                                <AlertCircle className="w-4 h-4" />
                                <span>Not supported</span>
                            </div>
                        )}
                    </div>

                    {bluetoothError && (
                        <div className="mt-3 p-3 bg-red-50 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-red-600">{bluetoothError}</p>
                        </div>
                    )}

                    {!isBluetoothSupported && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                            <p className="text-xs text-amber-700">
                                Web Bluetooth requires Chrome/Edge browser and HTTPS connection.
                            </p>
                        </div>
                    )}
                </div>

                {/* Goal Selection */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase px-1">Choose Goal</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {(['relax', 'balance', 'activate'] as TrainingGoal[]).map((g) => (
                            <button
                                key={g}
                                onClick={() => setGoal(g)}
                                className={`py-3 px-2 rounded-xl text-sm font-medium capitalize transition-all border-2
                            ${goal === g
                                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                                        : 'bg-white border-transparent text-gray-600 hover:bg-gray-100'}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleGenerate}
                    className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold active:bg-gray-800 shadow-md"
                >
                    Generate AI Pattern
                </button>

                {/* Pattern Card */}
                {pattern && (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-purple-100 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Training Session</h2>
                                <div className="text-purple-600 font-mono text-lg">{pattern.baseBpm} BPM • {pattern.durationMinutes} Min</div>
                            </div>
                        </div>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                            {pattern.description}
                        </p>

                        <button
                            onClick={togglePlay}
                            className={`w-full py-5 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                        ${isPlaying
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-xl shadow-purple-200'
                                }`}
                        >
                            {isPlaying ? (
                                <>
                                    <Square fill="currentColor" className="w-5 h-5" />
                                    Stop Training
                                </>
                            ) : (
                                <>
                                    <Play fill="currentColor" className="w-5 h-5" />
                                    Start Session
                                </>
                            )}
                        </button>
                    </div>
                )}

            </main>
        </div>
    )
}
