import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Activity, Share2, Trash2 } from 'lucide-react'
import { type SessionRecord, getSession, deleteSession } from '../features/history/sessionStore'

export default function SessionDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [session, setSession] = useState<SessionRecord | null>(null)
    const [loading, setLoading] = useState(true)
    const [deleted, setDeleted] = useState(false)

    useEffect(() => {
        if (id) {
            getSession(id).then(data => {
                setSession(data)
                setLoading(false)
            })
        }
    }, [id])

    const handleDelete = async () => {
        if (id && confirm('Are you sure you want to delete this session?')) {
            await deleteSession(id)
            setDeleted(true)
        }
    }

    if (deleted) {
        return <Navigate to="/history" replace />
    }

    if (loading) return <div className="p-10 text-center">Loading...</div>
    if (!session) return <div className="p-10 text-center">Session not found.</div>

    const durationMin = Math.round((session.endTime - session.startTime) / 60000)

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/history" className="text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        <h1 className="text-lg font-bold text-gray-900">Session Details</h1>
                    </div>
                    <button onClick={handleDelete} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                {/* Summary Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-400 mb-1">{new Date(session.startTime).toLocaleString()}</div>
                    <div className="flex items-end gap-2 mb-6">
                        <span className="text-4xl font-bold text-gray-900">{durationMin}</span>
                        <span className="text-gray-500 mb-1">min duration</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase">Avg Heart Rate</div>
                            <div className="text-xl font-bold text-gray-800">{Math.round(session.avgBpm)} bpm</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase">Avg RMSSD</div>
                            <div className="text-xl font-bold text-gray-800">{Math.round(session.avgRmssd)} ms</div>
                        </div>
                    </div>
                </div>

                {/* JSON Export */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase">Raw Data (JSON)</h3>
                        <button
                            onClick={() => navigator.clipboard.writeText(JSON.stringify(session, null, 2))}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                            <Share2 className="w-4 h-4" />
                        </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-64 font-mono">
                        {JSON.stringify(session, null, 2)}
                    </pre>
                </div>

            </main>
        </div>
    )
}
