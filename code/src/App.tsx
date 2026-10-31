import { Route, Routes, useLocation } from 'react-router'
import Sidebar from './components/Sidebar'
import Chat from './pages/Chat'
import Home from './pages/Home'
import Scene from './pages/Scene'

export default function App() {
  // Remount the chat on every navigation so its local state resets
  const { key } = useLocation()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat/:id" element={<Chat key={key} />} />
        <Route path="/scene" element={<Scene />} />
      </Routes>
    </div>
  )
}
