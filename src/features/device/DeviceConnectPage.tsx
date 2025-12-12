import { useNavigate } from 'react-router-dom'
import { useDevice } from './DeviceContext'
import { Bluetooth, MonitorPlay } from 'lucide-react'

export default function DeviceConnectPage() {
    const { connect, error } = useDevice()
    const navigate = useNavigate()

    const handleConnect = async (mode: 'ble-real' | 'demo-simulated') => {
        try {
            await connect(mode)
            navigate('/live')
        } catch (e) {
            // Error is handled in context and exposed via error state
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-6">
            <div className="max-w-md w-full text-center space-y-8">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight">HRV Companion</h1>
                    <p className="mt-2 text-lg text-gray-600">Connect a heart rate sensor to begin.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        onClick={() => handleConnect('ble-real')}
                        className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-xl text-lg font-semibold shadow-lg hover:bg-indigo-700 transition-all active:scale-95 touch-manipulation"
                    >
                        <Bluetooth className="w-6 h-6" />
                        Connect Bluetooth Device
                    </button>

                    <button
                        onClick={() => handleConnect('demo-simulated')}
                        className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white text-gray-900 border-2 border-gray-200 rounded-xl text-lg font-semibold hover:border-indigo-300 hover:text-indigo-600 transition-all active:scale-95 touch-manipulation"
                    >
                        <MonitorPlay className="w-6 h-6" />
                        Use Demo Mode
                    </button>
                </div>

                <p className="text-xs text-gray-400 mt-8">
                    Note: Web Bluetooth requires a compatible browser (Chrome/Edge/Bluefy) and HTTPS.
                </p>
            </div>
        </div>
    )
}
