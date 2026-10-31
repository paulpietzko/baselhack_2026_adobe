import { NavLink, Route, Routes } from 'react-router'
import Home from './pages/Home'
import Scene from './pages/Scene'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex gap-4 border-b border-gray-200 px-6 py-3">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'font-semibold' : 'text-gray-500')}>
          Home
        </NavLink>
        <NavLink to="/scene" className={({ isActive }) => (isActive ? 'font-semibold' : 'text-gray-500')}>
          Scene
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scene" element={<Scene />} />
      </Routes>
    </div>
  )
}
