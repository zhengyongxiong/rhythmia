import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar } from 'lucide-react'
import { type SessionRecord, listSessions } from '../features/history/sessionStore'

export default function HistoryPage() {
    const [sessions, setSessions] = useState<SessionRecord[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        listSessions().then(data => {
            setSessions(data)
            setLoading(false)
        })
    }, [])

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <h1 className="text-lg font-bold text-gray-900">History</h1>
                    </div>
                    <div className="w-6"></div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-gray-500">Loading history...</div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">No sessions recorded yet.</div>
                ) : (
                    sessions.map(session => (
                        <Link key={session.id} to={`/history/${session.id}`} className="block">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-sm font-medium text-gray-900">
                                        {new Date(session.startTime).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {Math.round((session.endTime - session.startTime) / 60000)} min
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                    <div className="bg-indigo-50 rounded p-1">
                                        <span className="block text-xs text-indigo-400">HR</span>
                                        <span className="font-bold text-indigo-700">{Math.round(session.avgBpm)}</span>
                                    </div>
                                    <div className="bg-teal-50 rounded p-1">
                                        <span className="block text-xs text-teal-400">RMSSD</span>
                                        <span className="font-bold text-teal-700">{Math.round(session.avgRmssd)}</span>
                                    </div>
                                    <div className="bg-blue-50 rounded p-1">
                                        <span className="block text-xs text-blue-400">SDNN</span>
                                        <span className="font-bold text-blue-700">{Math.round(session.avgSdnn)}</span>
                                    </div>
                                    <div className="bg-gray-50 rounded p-1 flex flex-col items-center justify-center">
                                        {session.userMood && <span className="text-xs capitalize text-gray-500">{session.userMood}</span>}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </main>
        </div>
    )
}
