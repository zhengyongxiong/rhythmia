import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'
import { askHealthAdvisor, type HealthStats } from '../features/advisor/mockService'
import { useLiveMetrics } from '../features/hrv/useLiveMetrics'

interface Message {
    id: string
    role: 'user' | 'assistant'
    text: string
    timestamp: number
}

export default function AIAdvisorPage() {
    const { hrv, bpm } = useLiveMetrics()
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', text: 'Hello! I am your health companion. I see your heart data is available. How are you feeling today?', timestamp: Date.now() }
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input, timestamp: Date.now() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsTyping(true)

        try {
            // Construct mock stats from live metrics (or use historical if we had access here easily)
            const stats: HealthStats = {
                avgBpm: bpm || 70,
                avgRmssd: hrv.rmssd || 40,
                trend: 'stable' // Simplified
            }

            const responseText = await askHealthAdvisor(userMsg.text, stats)

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: responseText,
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, aiMsg])
        } catch (e) {
            // error
        } finally {
            setIsTyping(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10 flex-none">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-teal-600" />
                        <h1 className="text-lg font-bold text-gray-900">AI Advisor</h1>
                    </div>
                    <div className="w-6"></div>
                </div>
                {/* Context Stats Bar */}
                <div className="bg-teal-50 px-4 py-2 border-b border-teal-100 flex justify-center gap-6 text-xs text-teal-800">
                    <span>Recent HR: <strong>{bpm > 0 ? bpm : '--'}</strong></span>
                    <span>RMSSD: <strong>{hrv.rmssd > 0 ? hrv.rmssd : '--'}</strong></span>
                </div>
            </header>

            {/* Chat Area */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} `}>
                        <div className={`max - w - [80 %] rounded - 2xl px - 4 py - 3 shadow - sm ${msg.role === 'user'
                            ? 'bg-teal-600 text-white rounded-br-none'
                            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                            } `}>
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white text-gray-400 border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 text-sm italic">
                            Advisor is typing...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            {/* Input Area */}
            <footer className="bg-white border-t border-gray-200 p-4 sticky bottom-0 flex-none">
                <div className="max-w-3xl mx-auto flex gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        type="text"
                        placeholder="Ask about your health..."
                        className="flex-1 bg-gray-100 border-0 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="bg-teal-600 text-white p-3 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </footer>
        </div>
    )
}
