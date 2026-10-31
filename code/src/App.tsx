import { Route, Routes } from 'react-router'
import Home from './pages/Home'
import Scene from './pages/Scene'
import TestMap from './pages/TestMap'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scene" element={<Scene />} />
        <Route path="/test-map" element={<TestMap />} />
      </Routes>
    </div>
  )
}
