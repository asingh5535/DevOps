import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Costs from './pages/Costs'
import Compliance from './pages/Compliance'
import Resources from './pages/Resources'
import Namespaces from './pages/Namespaces'

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/namespaces" element={<Namespaces />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
