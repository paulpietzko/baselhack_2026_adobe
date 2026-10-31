import { Route, Routes } from 'react-router'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Home from './pages/Home'
import Scene from './pages/Scene'
import TestMap from './pages/TestMap'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scene" element={<Scene />} />
          <Route path="/test-map" element={<TestMap />} />
        </Routes>
      </div>
    </div>
  )
}
