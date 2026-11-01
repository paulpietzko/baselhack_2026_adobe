import { Outlet, Route, Routes } from 'react-router'
import HandLayer from './components/duck/HandLayer'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Home from './pages/Home'
import Scene from './pages/Scene'
import TestMap from './pages/TestMap'
import Vendor from './pages/Vendor'

function ClaudeShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <Outlet />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<ClaudeShell />}>
        <Route
          path="/"
          element={
            <>
              <Home />
              <HandLayer />
            </>
          }
        />
        <Route path="/scene" element={<Scene />} />
        <Route path="/test-map" element={<TestMap />} />
      </Route>
      {/* Acme vendor portal: its own brand, no Claude chrome */}
      <Route path="/vendor" element={<Vendor />} />
    </Routes>
  )
}
