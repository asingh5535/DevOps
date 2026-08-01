import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Objectives from '@/pages/Objectives'
import ObjectiveDetail from '@/pages/ObjectiveDetail'
import Clusters from '@/pages/Clusters'
import Settings from '@/pages/Settings'
import { useAuthStore } from '@/store/auth'

function ProtectedRoute({ element }: { element: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AppLayout>{element}</AppLayout>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} />} />
        <Route path="/objectives" element={<ProtectedRoute element={<Objectives />} />} />
        <Route path="/objectives/:id" element={<ProtectedRoute element={<ObjectiveDetail />} />} />
        <Route path="/clusters" element={<ProtectedRoute element={<Clusters />} />} />
        <Route path="/settings" element={<ProtectedRoute element={<Settings />} />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
