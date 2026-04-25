import React, { useEffect } from 'react'
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation,
} from 'react-router-dom'
import { Spin } from 'antd'
import AppLayout from '@/components/Layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Deployments from '@/pages/Workloads/Deployments'
import Pods from '@/pages/Workloads/Pods'
import {
  StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs,
} from '@/pages/Workloads/GenericWorkload'
import { Services, Ingresses, NetworkPolicies } from '@/pages/Networking'
import {
  ConfigMaps, Secrets, PersistentVolumes, PersistentVolumeClaims, StorageClasses,
} from '@/pages/Config'
import {
  ClusterRoles, Roles, ClusterRoleBindings, RoleBindings, ServiceAccounts,
} from '@/pages/RBAC'
import CRDs from '@/pages/CRDs'
import Nodes from '@/pages/Nodes'
import Events from '@/pages/Events'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/services/api'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [verifying, setVerifying] = React.useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } })
      setVerifying(false)
      return
    }
    authApi.verify()
      .then(() => setVerifying(false))
      .catch(() => {
        logout()
        navigate('/login')
      })
  }, [])

  if (verifying) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0a',
      }}>
        <Spin size="large" tip="Connecting to cluster..." />
      </div>
    )
  }

  return <>{children}</>
}

function ProtectedRoute({ element }: { element: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppLayout>{element}</AppLayout>
    </AuthGuard>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} />} />

        {/* Workloads */}
        <Route path="/workloads/deployments" element={<ProtectedRoute element={<Deployments />} />} />
        <Route path="/workloads/statefulsets" element={<ProtectedRoute element={<StatefulSets />} />} />
        <Route path="/workloads/daemonsets" element={<ProtectedRoute element={<DaemonSets />} />} />
        <Route path="/workloads/replicasets" element={<ProtectedRoute element={<ReplicaSets />} />} />
        <Route path="/workloads/pods" element={<ProtectedRoute element={<Pods />} />} />
        <Route path="/workloads/jobs" element={<ProtectedRoute element={<Jobs />} />} />
        <Route path="/workloads/cronjobs" element={<ProtectedRoute element={<CronJobs />} />} />

        {/* Networking */}
        <Route path="/networking/services" element={<ProtectedRoute element={<Services />} />} />
        <Route path="/networking/ingresses" element={<ProtectedRoute element={<Ingresses />} />} />
        <Route path="/networking/networkpolicies" element={<ProtectedRoute element={<NetworkPolicies />} />} />

        {/* Config & Storage */}
        <Route path="/config/configmaps" element={<ProtectedRoute element={<ConfigMaps />} />} />
        <Route path="/config/secrets" element={<ProtectedRoute element={<Secrets />} />} />
        <Route path="/storage/pvs" element={<ProtectedRoute element={<PersistentVolumes />} />} />
        <Route path="/storage/pvcs" element={<ProtectedRoute element={<PersistentVolumeClaims />} />} />
        <Route path="/storage/storageclasses" element={<ProtectedRoute element={<StorageClasses />} />} />

        {/* RBAC */}
        <Route path="/rbac/clusterroles" element={<ProtectedRoute element={<ClusterRoles />} />} />
        <Route path="/rbac/roles" element={<ProtectedRoute element={<Roles />} />} />
        <Route path="/rbac/clusterrolebindings" element={<ProtectedRoute element={<ClusterRoleBindings />} />} />
        <Route path="/rbac/rolebindings" element={<ProtectedRoute element={<RoleBindings />} />} />
        <Route path="/rbac/serviceaccounts" element={<ProtectedRoute element={<ServiceAccounts />} />} />

        {/* CRDs, Nodes, Events */}
        <Route path="/crds" element={<ProtectedRoute element={<CRDs />} />} />
        <Route path="/nodes" element={<ProtectedRoute element={<Nodes />} />} />
        <Route path="/events" element={<ProtectedRoute element={<Events />} />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
