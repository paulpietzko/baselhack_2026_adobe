import { Route, Routes } from 'react-router'
import Home from './pages/Home'
import Scene from './pages/Scene'
import TestMap from './pages/TestMap'
import Vendor from './pages/Vendor'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/scene" element={<Scene />} />
      <Route path="/test-map" element={<TestMap />} />
      {/* Acme vendor portal: the owner's side, with its own brand */}
      <Route path="/vendor" element={<Vendor />} />
    </Routes>
  )
}
