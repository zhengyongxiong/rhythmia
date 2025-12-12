import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { DeviceProvider } from './features/device/DeviceContext'
import DeviceConnectPage from './features/device/DeviceConnectPage'
import LiveMonitorPage from './routes/LiveMonitorPage'
import BeatTrainerPage from './routes/BeatTrainerPage'
import HistoryPage from './routes/HistoryPage'
import SessionDetailPage from './routes/SessionDetailPage'
import AIAdvisorPage from './routes/AIAdvisorPage'
import { Activity, Brain, Calendar, Sparkles } from 'lucide-react'
import { InstallPwa } from './components/InstallPwa'

function Layout() {
  const location = useLocation()
  // const hideNavPaths = ['/'] // Hide nav on connect screen? Or maybe show but disable.
  // Actually connect screen is '/', so we might want to hide nav there if strictly modal,
  // but user might want to check history without connecting.
  // Let's hide nav only if not connected? No, simpler to always show except maybe splash.
  // For this MVP, let's keep it simple: DeviceConnectPage is home. Nav is always visible
  // BUT LiveMonitorPage requires connection.

  // Let's decide: "/" is Connect. Nav is meaningful for History/Advisor even without device.
  // Beat/Live require device.

  const isConnectPage = location.pathname === '/'

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <InstallPwa />
      <Routes>
        <Route path="/" element={<DeviceConnectPage />} />
        <Route path="/live" element={<LiveMonitorPage />} />
        <Route path="/train" element={<BeatTrainerPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<SessionDetailPage />} />
        <Route path="/advisor" element={<AIAdvisorPage />} />
      </Routes>

      {/* Bottom Navigation */}
      {!isConnectPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-2 px-6 flex justify-between items-center z-50 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
          <NavLink to="/live"
            className={({ isActive }) => `flex flex - col items - center gap - 1 p - 2 min - w - [60px] ${isActive ? 'text-indigo-600' : 'text-gray-400'} `}>
            <Activity className="w-6 h-6" />
            <span className="text-[10px] font-medium">Live</span>
          </NavLink>
          <NavLink to="/train"
            className={({ isActive }) => `flex flex - col items - center gap - 1 p - 2 min - w - [60px] ${isActive ? 'text-purple-600' : 'text-gray-400'} `}>
            <Brain className="w-6 h-6" />
            <span className="text-[10px] font-medium">Train</span>
          </NavLink>
          <NavLink to="/advisor"
            className={({ isActive }) => `flex flex - col items - center gap - 1 p - 2 min - w - [60px] ${isActive ? 'text-teal-600' : 'text-gray-400'} `}>
            <Sparkles className="w-6 h-6" />
            <span className="text-[10px] font-medium">Advisor</span>
          </NavLink>
          <NavLink to="/history"
            className={({ isActive }) => `flex flex - col items - center gap - 1 p - 2 min - w - [60px] ${isActive ? 'text-blue-600' : 'text-gray-400'} `}>
            <Calendar className="w-6 h-6" />
            <span className="text-[10px] font-medium">History</span>
          </NavLink>
        </nav>
      )}
    </div>
  )
}

function App() {
  return (
    <DeviceProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </DeviceProvider>
  )
}

export default App
