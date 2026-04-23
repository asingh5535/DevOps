import React, { useState, useEffect } from 'react'
import { Layout, Menu, Select, Avatar, Dropdown, Badge, Typography, Space, Tag } from 'antd'
import {
  DashboardOutlined, AppstoreOutlined, ApartmentOutlined, CloudServerOutlined,
  DatabaseOutlined, LockOutlined, ApiOutlined, BellOutlined, SettingOutlined,
  LogoutOutlined, UserOutlined, ClusterOutlined, DeploymentUnitOutlined,
  NodeIndexOutlined, ScheduleOutlined, ContainerOutlined, KeyOutlined,
  SafetyOutlined, CodeOutlined, GlobalOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { clusterApi } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import { useNamespaceStore } from '@/store/namespace'
import type { KubeList, KubeMetadata } from '@/types'

const { Sider, Header, Content } = Layout
const { Text } = Typography

interface AppLayoutProps {
  children: React.ReactNode
}

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: 'workloads',
    icon: <AppstoreOutlined />,
    label: 'Workloads',
    children: [
      { key: '/workloads/deployments', icon: <DeploymentUnitOutlined />, label: 'Deployments' },
      { key: '/workloads/statefulsets', icon: <DatabaseOutlined />, label: 'StatefulSets' },
      { key: '/workloads/daemonsets', icon: <ClusterOutlined />, label: 'DaemonSets' },
      { key: '/workloads/replicasets', icon: <ApartmentOutlined />, label: 'ReplicaSets' },
      { key: '/workloads/pods', icon: <ContainerOutlined />, label: 'Pods' },
      { key: '/workloads/jobs', icon: <ThunderboltOutlined />, label: 'Jobs' },
      { key: '/workloads/cronjobs', icon: <ScheduleOutlined />, label: 'CronJobs' },
    ],
  },
  {
    key: 'networking',
    icon: <GlobalOutlined />,
    label: 'Networking',
    children: [
      { key: '/networking/services', icon: <ApiOutlined />, label: 'Services' },
      { key: '/networking/ingresses', icon: <NodeIndexOutlined />, label: 'Ingresses' },
      { key: '/networking/networkpolicies', icon: <SafetyOutlined />, label: 'Network Policies' },
    ],
  },
  {
    key: 'config',
    icon: <SettingOutlined />,
    label: 'Config & Storage',
    children: [
      { key: '/config/configmaps', icon: <DatabaseOutlined />, label: 'ConfigMaps' },
      { key: '/config/secrets', icon: <KeyOutlined />, label: 'Secrets' },
      { key: '/storage/pvs', icon: <CloudServerOutlined />, label: 'Persistent Volumes' },
      { key: '/storage/pvcs', icon: <DatabaseOutlined />, label: 'PVC' },
      { key: '/storage/storageclasses', icon: <AppstoreOutlined />, label: 'Storage Classes' },
    ],
  },
  {
    key: 'rbac',
    icon: <LockOutlined />,
    label: 'RBAC',
    children: [
      { key: '/rbac/clusterroles', icon: <SafetyOutlined />, label: 'Cluster Roles' },
      { key: '/rbac/roles', icon: <LockOutlined />, label: 'Roles' },
      { key: '/rbac/clusterrolebindings', icon: <UserOutlined />, label: 'Cluster Role Bindings' },
      { key: '/rbac/rolebindings', icon: <UserOutlined />, label: 'Role Bindings' },
      { key: '/rbac/serviceaccounts', icon: <UserOutlined />, label: 'Service Accounts' },
    ],
  },
  {
    key: '/crds',
    icon: <CodeOutlined />,
    label: 'CRDs',
  },
  {
    key: '/nodes',
    icon: <CloudServerOutlined />,
    label: 'Nodes',
  },
  {
    key: '/events',
    icon: <BellOutlined />,
    label: 'Events',
  },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, serverVersion, serverUrl } = useAuthStore()
  const { selectedNamespace, setNamespace } = useNamespaceStore()
  const [namespaces, setNamespaces] = useState<string[]>(['default'])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    clusterApi.listNamespaces().then((res) => {
      const list = res.data as KubeList<{ metadata: KubeMetadata }>
      setNamespaces(list.items.map((n) => n.metadata.name))
    }).catch(() => {})
  }, [])

  const selectedKey = location.pathname
  const openKeys = menuItems
    .filter((m) => m.children?.some((c) => c.key === location.pathname))
    .map((m) => m.key)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{
          background: '#0d1117',
          borderRight: '1px solid #21262d',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #1677ff, #0958d9)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}>
            ☸
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                KubeVision
              </div>
              <div style={{ color: '#8b949e', fontSize: 10 }}>Enterprise K8s Manager</div>
            </div>
          )}
        </div>

        {/* Cluster info */}
        {!collapsed && serverVersion && (
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid #21262d',
          }}>
            <Tag color="blue" style={{ fontSize: 10 }}>{serverVersion}</Tag>
          </div>
        )}

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: '#0d1117', borderRight: 0, paddingTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: '#0d1117',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          height: 56,
        }}>
          {/* Namespace selector */}
          <Space>
            <Text style={{ color: '#8b949e', fontSize: 13 }}>Namespace:</Text>
            <Select
              value={selectedNamespace}
              onChange={setNamespace}
              style={{ width: 180 }}
              size="small"
              showSearch
              options={[
                { value: '', label: 'All Namespaces' },
                ...namespaces.map((n) => ({ value: n, label: n })),
              ]}
            />
          </Space>

          {/* Right side */}
          <Space size={16}>
            {serverUrl && (
              <Text style={{ color: '#8b949e', fontSize: 12 }}>
                {serverUrl.replace(/^https?:\/\//, '')}
              </Text>
            )}

            <Badge count={0} dot>
              <BellOutlined style={{ color: '#8b949e', fontSize: 16, cursor: 'pointer' }} />
            </Badge>

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'user',
                    label: 'Cluster Admin',
                    disabled: true,
                    icon: <UserOutlined />,
                  },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    label: 'Disconnect',
                    icon: <LogoutOutlined />,
                    danger: true,
                    onClick: () => { logout(); navigate('/login') },
                  },
                ],
              }}
              placement="bottomRight"
            >
              <Avatar
                size={32}
                style={{ background: '#1677ff', cursor: 'pointer' }}
                icon={<UserOutlined />}
              />
            </Dropdown>
          </Space>
        </Header>

        <Content style={{
          padding: 24,
          background: '#0a0a0a',
          minHeight: 'calc(100vh - 56px)',
          overflow: 'auto',
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
