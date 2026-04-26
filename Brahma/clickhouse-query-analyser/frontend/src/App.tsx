import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import SlowQueries from './pages/SlowQueries'
import FullScans from './pages/FullScans'
import MemoryHogs from './pages/MemoryHogs'
import QueryExplain from './pages/QueryExplain'
import OptimizationGuide from './pages/OptimizationGuide'
import Reports from './pages/Reports'
import Clusters from './pages/Clusters'

const App: React.FC = () => (
  <ConfigProvider
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#238636',
        colorBgBase: '#0d1117',
        colorBgContainer: '#161b22',
        colorBorder: '#30363d',
        colorText: '#e6edf3',
        colorTextSecondary: '#8b949e',
        borderRadius: 6,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
    }}
  >
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/slow-queries" element={<SlowQueries />} />
          <Route path="/full-scans" element={<FullScans />} />
          <Route path="/memory-hogs" element={<MemoryHogs />} />
          <Route path="/explain" element={<QueryExplain />} />
          <Route path="/optimization" element={<OptimizationGuide />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/clusters" element={<Clusters />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  </ConfigProvider>
)

export default App
